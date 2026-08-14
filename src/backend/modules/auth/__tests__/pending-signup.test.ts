import bcrypt from 'bcryptjs';
import * as db from '../../../common/testing/db';
import PendingSignup from '../pending-signup.model';
import User from '../../users/user.model';
import {
  checkOtp,
  createUserFrom,
  discardSignup,
  findSignup,
  refreshOtp,
  startSignup
} from '../pending-signup.service';

/**
 * The signup held between requesting an OTP and verifying it.
 *
 * This replaced `req.session.pendingUser`. Three things are worth pinning:
 *
 *  - The password survives the round trip. It is bcrypt-hashed on the way in
 *    and must NOT be hashed again when the user is created, or the account
 *    would exist with a password that can never match. That is the subtlest
 *    thing in the change, so it is tested by actually signing in.
 *  - The plaintext password never reaches the database. The session stored it
 *    in clear in the session collection until it expired.
 *  - The record is found by email, not by session, so a lost session no longer
 *    strands someone who already has a code.
 */

const INPUT = {
  name: 'Pending Person',
  email: 'Pending.Person@Example.com',
  phone: '9876543210',
  password: 'CorrectHorse1!'
};

describe('pending signup', () => {
  beforeAll(async () => {
    await db.connect();
    await PendingSignup.init();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await PendingSignup.deleteMany({});
    await User.deleteMany({});
  });

  it('never stores the plaintext password', async () => {
    await startSignup(INPUT);

    const stored = await PendingSignup.findOne({ email: INPUT.email.toLowerCase() }).lean();

    expect(JSON.stringify(stored)).not.toContain(INPUT.password);
    expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('never stores the OTP itself', async () => {
    const { otp } = await startSignup(INPUT);

    const stored = await PendingSignup.findOne({ email: INPUT.email.toLowerCase() }).lean();

    expect(stored?.otpHash).not.toBe(otp);
    expect(JSON.stringify(stored)).not.toContain(otp);
  });

  it('is found by email rather than by session', async () => {
    await startSignup(INPUT);

    // Nothing here carries a request, a cookie or a session.
    const found = await findSignup(INPUT.email);

    expect(found?.name).toBe(INPUT.name);
  });

  it('matches the email case-insensitively', async () => {
    await startSignup(INPUT);

    expect(await findSignup('pending.person@example.com')).not.toBeNull();
    expect(await findSignup('PENDING.PERSON@EXAMPLE.COM')).not.toBeNull();
  });

  it('replaces the previous attempt rather than leaving two rows', async () => {
    // A second row would be unreachable - only one could ever match the code.
    await startSignup(INPUT);
    await startSignup({ ...INPUT, name: 'Renamed' });

    const all = await PendingSignup.find({ email: INPUT.email.toLowerCase() });

    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('Renamed');
  });

  it('accepts the code it issued', async () => {
    const { otp } = await startSignup(INPUT);
    const pending = (await findSignup(INPUT.email))!;

    expect(checkOtp(pending, otp)).toBe('ok');
  });

  it('rejects a wrong code', async () => {
    const { otp } = await startSignup(INPUT);
    const pending = (await findSignup(INPUT.email))!;

    const wrong = otp === '000000' ? '111111' : '000000';
    expect(checkOtp(pending, wrong)).toBe('incorrect');
  });

  it('reports an expired code separately from a wrong one', async () => {
    // The two produce different responses - 410 vs 401 - so the shopper is
    // told to request a new code rather than to retype the old one.
    const { otp } = await startSignup(INPUT);
    const pending = (await findSignup(INPUT.email))!;

    pending.otpExpiresAt = new Date(Date.now() - 1000);

    expect(checkOtp(pending, otp)).toBe('expired');
  });

  it('issues a fresh code on resend and invalidates the old one', async () => {
    const { otp: first } = await startSignup(INPUT);

    const resent = await refreshOtp(INPUT.email);
    const pending = (await findSignup(INPUT.email))!;

    expect(resent?.otp).toBeDefined();
    expect(checkOtp(pending, resent!.otp)).toBe('ok');
    expect(checkOtp(pending, first)).toBe('incorrect');
  });

  it('has nothing to resend when there is no attempt', async () => {
    expect(await refreshOtp('nobody@example.com')).toBeNull();
  });

  it('creates a user who can sign in with the password they chose', async () => {
    // The one that matters. The password is already bcrypt-hashed, and the
    // User model hashes on save - so without unmarking it the account would
    // exist with a hash of a hash and the password would never work.
    await startSignup(INPUT);
    const pending = (await findSignup(INPUT.email))!;

    const user = await createUserFrom(pending);

    const stored = await User.findById(user._id).select('+password');
    expect(await bcrypt.compare(INPUT.password, stored!.password)).toBe(true);
  });

  it('creates the user only at verification, which is what makes them verified', async () => {
    // The User model has no isVerified flag and does not need one: a row only
    // reaches the users collection once the OTP has been checked, so existence
    // is verification. Before that the signup lives only in PendingSignup.
    await startSignup(INPUT);

    expect(await User.findOne({ email: INPUT.email.toLowerCase() })).toBeNull();

    const pending = (await findSignup(INPUT.email))!;
    await createUserFrom(pending);

    expect(await User.findOne({ email: INPUT.email.toLowerCase() })).not.toBeNull();
  });

  it('carries the referral across', async () => {
    await startSignup({ ...INPUT, referralCode: 'FRIEND10' });

    const pending = (await findSignup(INPUT.email))!;
    expect(pending.referralCode).toBe('FRIEND10');
  });

  it('discards the attempt once it is used', async () => {
    await startSignup(INPUT);
    await discardSignup(INPUT.email);

    expect(await findSignup(INPUT.email)).toBeNull();
  });

  it('expires on its own, so abandoned signups do not accumulate', async () => {
    const indexes = await PendingSignup.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);

    expect(ttl).toBeDefined();
    expect(ttl?.key).toHaveProperty('createdAt');
  });

  it('outlives the code, so "expired" can be told from "no such signup"', async () => {
    const indexes = await PendingSignup.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);

    // The OTP lasts a minute; the row must last considerably longer.
    expect(ttl!.expireAfterSeconds).toBeGreaterThan(60);
  });
});
