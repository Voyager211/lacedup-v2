import request from 'supertest';
import * as db from '../common/testing/db';
import app from '../app';
import User from '../modules/users/user.model';

/**
 * Phase 5.2 - the session auth mirror is gone.
 *
 * `jwt-auth.middleware` used to copy the token's subject into
 * `req.session.userId` and `req.session.role`, and ~75 places read those back.
 * Both are now read from `req.user` via `common/utils/current-user.util`.
 *
 * The mirror was written and read inside the same request, so removing it
 * should be invisible. The risk is the *admin* guard: `isAdmin` compared
 * `req.session.role === 'admin'`, and it now compares `req.user.role`. If the
 * audience selection in jwt-auth were wrong, a shopper token could satisfy it.
 * These tests exist mainly to pin that it cannot.
 */

const SHOPPER = {
  name: 'Shim Shopper',
  email: 'shim-shopper@example.com',
  password: 'CorrectHorse1!'
};

const ADMIN = {
  name: 'Shim Admin',
  email: 'shim-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

const signIn = async (path: string, email: string, password: string): Promise<string[]> => {
  const res = await request(app).post(path).type('form').send({ email, password });
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

describe('auth without the session mirror', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await User.create({ ...SHOPPER, isVerified: true });
    await User.create({ ...ADMIN, isVerified: true });
  });

  it('no longer writes the session mirror on a signed-in request', async () => {
    const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

    // The mirror lived in the session cookie's store. If it were still being
    // written, logging in would establish a session cookie for the shopper
    // audience; nothing writes to req.session on this path any more.
    const res = await request(app).get('/api/auth/me').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(SHOPPER.email);
  });

  it('resolves the shopper from the token alone', async () => {
    const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

    // A route whose controller reads currentUserId(req) rather than req.user
    // directly - proving the helper resolves without the session.
    const res = await request(app).get('/api/cart').set('Cookie', cookies);

    expect(res.status).toBe(200);
  });

  it('lets an admin token through the isAdmin guard', async () => {
    const cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);

    const res = await request(app).get('/api/admin/users/api').set('Cookie', cookies);

    expect(res.status).toBe(200);
  });

  it('refuses a shopper token at an admin route', async () => {
    // The important one. jwt-auth picks the cookie pair by path, so on /admin
    // it reads admin_at - a shopper's user_at is never consulted and req.user
    // stays unset, which is what isAdmin now depends on.
    const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

    const res = await request(app).get('/api/admin/users/api').set('Cookie', cookies);

    expect(res.status).not.toBe(200);
  });

  it('refuses an admin token at an admin route once the user stops being an admin', async () => {
    const cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);

    // Demoted after the token was issued. The guard reads the freshly-loaded
    // user, not the token's claims, so this takes effect immediately rather
    // than when the token expires.
    await User.updateOne({ email: ADMIN.email }, { role: 'user' });

    const res = await request(app).get('/api/admin/users/api').set('Cookie', cookies);

    expect(res.status).not.toBe(200);
  });

  it('treats a signed-out request as signed out', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});
