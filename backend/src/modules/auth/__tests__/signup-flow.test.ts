import { vi } from 'vitest';
import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';
import PendingSignup from '../pending-signup.model';

/**
 * Signup, end to end over HTTP.
 *
 * The service tests cover the store; this covers the routes, and in particular
 * that the flow no longer depends on the session. Every request below is made
 * with a fresh agent carrying no cookies at all - which is the scenario that
 * used to fail, because the OTP lived in `req.session.pendingUser` and a
 * shopper whose session was dropped was told their correct code was wrong.
 *
 * The mailer is stubbed so the test can read the code it sent.
 */

const sent: Array<{ email: string; otp: string }> = [];

vi.mock('../../../common/utils/send-otp.util', () => ({
  default: vi.fn(async (user: { email: string }, otp: string) => {
    sent.push({ email: user.email, otp });
  })
}));

const SIGNUP = {
  name: 'Flow Person',
  email: 'flow-person@example.com',
  phone: '9876543210',
  password: 'CorrectHorse1!',
  confirmPassword: 'CorrectHorse1!'
};

const lastOtpFor = (email: string) =>
  [...sent].reverse().find((entry) => entry.email === email)?.otp;

describe('signup over HTTP', () => {
  beforeAll(async () => {
    await db.connect();
    await PendingSignup.init();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    sent.length = 0;
    await User.deleteMany({});
    await PendingSignup.deleteMany({});
  });

  const signUp = () => request(app).post('/api/signup').type('form').send(SIGNUP);

  it('holds the signup without creating a user', async () => {
    const res = await signUp();

    expect(res.status).toBe(200);
    expect(await User.findOne({ email: SIGNUP.email })).toBeNull();
    expect(await PendingSignup.findOne({ email: SIGNUP.email })).not.toBeNull();
  });

  it('does not put the password in the database in plaintext', async () => {
    await signUp();

    const stored = await PendingSignup.findOne({ email: SIGNUP.email }).lean();

    expect(JSON.stringify(stored)).not.toContain(SIGNUP.password);
  });

  it('verifies with no session cookie at all', async () => {
    // The point of the migration. A brand new request, no cookies carried over
    // from the signup call, still verifies.
    await signUp();
    const otp = lastOtpFor(SIGNUP.email);

    const res = await request(app)
      .post('/api/verify-otp')
      .type('form')
      .send({ email: SIGNUP.email, otp });

    expect(res.status).toBe(200);
    expect(await User.findOne({ email: SIGNUP.email })).not.toBeNull();
  });

  it('lets the new user sign in with the password they chose', async () => {
    // Guards the double-hash trap: the password is stored hashed and must not
    // be hashed again when the account is created.
    await signUp();
    const otp = lastOtpFor(SIGNUP.email);

    await request(app).post('/api/verify-otp').type('form').send({ email: SIGNUP.email, otp });

    const res = await request(app)
      .post('/api/login')
      .type('form')
      .send({ email: SIGNUP.email, password: SIGNUP.password });

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.some((cookie) => cookie.startsWith('user_at='))).toBe(true);
  });

  it('rejects a wrong code without discarding the attempt', async () => {
    await signUp();

    const res = await request(app)
      .post('/api/verify-otp')
      .type('form')
      .send({ email: SIGNUP.email, otp: '000000' });

    expect(res.status).toBe(401);
    // Still recoverable - a typo must not force the shopper to start again.
    expect(await PendingSignup.findOne({ email: SIGNUP.email })).not.toBeNull();
  });

  it('resends a working code, again with no session', async () => {
    await signUp();
    const first = lastOtpFor(SIGNUP.email);

    const resend = await request(app)
      .post('/api/resend-otp')
      .type('form')
      .send({ email: SIGNUP.email });
    expect(resend.status).toBe(200);

    const second = lastOtpFor(SIGNUP.email);
    expect(second).not.toBe(first);

    const res = await request(app)
      .post('/api/verify-otp')
      .type('form')
      .send({ email: SIGNUP.email, otp: second });

    expect(res.status).toBe(200);
  });

  it('invalidates the previous code when a new one is sent', async () => {
    await signUp();
    const first = lastOtpFor(SIGNUP.email);

    await request(app).post('/api/resend-otp').type('form').send({ email: SIGNUP.email });

    const res = await request(app)
      .post('/api/verify-otp')
      .type('form')
      .send({ email: SIGNUP.email, otp: first });

    expect(res.status).toBe(401);
  });

  it('clears the pending row once the account exists', async () => {
    await signUp();
    const otp = lastOtpFor(SIGNUP.email);

    await request(app).post('/api/verify-otp').type('form').send({ email: SIGNUP.email, otp });

    expect(await PendingSignup.findOne({ email: SIGNUP.email })).toBeNull();
  });
});
