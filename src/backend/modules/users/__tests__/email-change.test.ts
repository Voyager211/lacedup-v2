import mongoose from 'mongoose';
import * as db from '../../../common/testing/db';
import EmailChange from '../email-change.model';
import {
  checkOtp,
  discardEmailChange,
  findEmailChange,
  markVerified,
  refreshOtp,
  startEmailChange
} from '../email-change.service';

/**
 * The email change in progress.
 *
 * This replaced `req.session.emailChangeOtp`, which two different flows wrote
 * with two different shapes - which is why its type declaration had almost
 * every field optional. One record keyed by user now serves both:
 *
 *  - one step: the new address is supplied up front, the code goes to the
 *    current address, and verifying it applies the change.
 *  - two step: the code proves ownership of the current address first, and
 *    only then is the new address accepted.
 *
 * The code is hashed here. The session stored it in clear, which the signup
 * flow never did - the two had drifted apart.
 */

describe('email change', () => {
  let userId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await db.connect();
    await EmailChange.init();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await EmailChange.deleteMany({});
    userId = new mongoose.Types.ObjectId();
  });

  const start = (overrides = {}) =>
    startEmailChange({ userId, currentEmail: 'old@example.com', ...overrides });

  it('never stores the code itself', async () => {
    const { otp } = await start();

    const stored = await EmailChange.findOne({ userId }).lean();

    expect(stored?.otpHash).not.toBe(otp);
    expect(JSON.stringify(stored)).not.toContain(otp);
  });

  it('is found by user rather than by session', async () => {
    await start();

    // No request, no cookie, no session.
    expect(await findEmailChange(userId)).not.toBeNull();
  });

  it('accepts the code it issued', async () => {
    const { otp } = await start();
    const record = (await findEmailChange(userId))!;

    expect(checkOtp(record, otp)).toBe('ok');
  });

  it('rejects a wrong code', async () => {
    const { otp } = await start();
    const record = (await findEmailChange(userId))!;

    expect(checkOtp(record, otp === '000000' ? '111111' : '000000')).toBe('incorrect');
  });

  it('reports expiry separately from a wrong code', async () => {
    const { otp } = await start();
    const record = (await findEmailChange(userId))!;
    record.otpExpiresAt = new Date(Date.now() - 1000);

    expect(checkOtp(record, otp)).toBe('expired');
  });

  it('holds the new address for the one-step flow', async () => {
    await start({ newEmail: 'new@example.com' });

    const record = (await findEmailChange(userId))!;
    expect(record.newEmail).toBe('new@example.com');
    expect(record.verified).toBe(false);
  });

  it('leaves the new address unset for the two-step flow', async () => {
    await start();

    const record = (await findEmailChange(userId))!;
    expect(record.newEmail).toBeNull();
  });

  it('records confirmation of the current address', async () => {
    await start();
    await markVerified(userId);

    expect((await findEmailChange(userId))!.verified).toBe(true);
  });

  it('drops a prior confirmation when the flow is restarted', async () => {
    // Otherwise a stale confirmed record could be used to skip the ownership
    // check on a fresh attempt.
    await start();
    await markVerified(userId);

    await start();

    expect((await findEmailChange(userId))!.verified).toBe(false);
  });

  it('replaces the attempt in progress rather than leaving two', async () => {
    await start();
    await start();

    expect(await EmailChange.countDocuments({ userId })).toBe(1);
  });

  it('honours a shorter expiry when asked', async () => {
    // The two-step flow has always used 45 seconds.
    const before = Date.now();
    await start({ ttlMs: 45 * 1000 });

    const record = (await findEmailChange(userId))!;
    expect(record.otpExpiresAt.getTime() - before).toBeLessThanOrEqual(45 * 1000);
  });

  it('resends a fresh code and invalidates the old one', async () => {
    const { otp: first } = await start();

    const resent = await refreshOtp(userId);
    const record = (await findEmailChange(userId))!;

    expect(checkOtp(record, resent!.otp)).toBe('ok');
    expect(checkOtp(record, first)).toBe('incorrect');
  });

  it('reports the address to resend to', async () => {
    await start();

    expect((await refreshOtp(userId))!.currentEmail).toBe('old@example.com');
  });

  it('has nothing to resend when no change is in progress', async () => {
    expect(await refreshOtp(new mongoose.Types.ObjectId())).toBeNull();
  });

  it('keeps one user out of another user record', async () => {
    await start();

    expect(await findEmailChange(new mongoose.Types.ObjectId())).toBeNull();
  });

  it('discards the record once the change is applied', async () => {
    await start();
    await discardEmailChange(userId);

    expect(await findEmailChange(userId)).toBeNull();
  });

  it('expires on its own, and outlives the code', async () => {
    const indexes = await EmailChange.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);

    expect(ttl?.key).toHaveProperty('createdAt');
    expect(ttl!.expireAfterSeconds).toBeGreaterThan(60);
  });
});
