import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';

/**
 * GET /api/auth/me and GET /api/admin/auth/me.
 *
 * These exist for the React client. Auth is carried in httpOnly cookies, so
 * the browser cannot read its own session - without these the SPA could not
 * tell a signed-in visitor from a signed-out one except by firing a request
 * and watching it fail, which would make every guarded route flicker.
 */

const SHOPPER = {
  name: 'Session Shopper',
  email: 'session-shopper@example.com',
  password: 'CorrectHorse1!'
};

const ADMIN = {
  name: 'Session Admin',
  email: 'session-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

/** Logs in and returns the cookie jar as supertest wants it. */
const signIn = async (path: string, email: string, password: string): Promise<string[]> => {
  const res = await request(app).post(path).type('form').send({ email, password });
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

describe('session introspection', () => {
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

  describe('GET /api/auth/me', () => {
    it('returns 401 rather than a null user when signed out', async () => {
      // 401 keeps it on the same refresh-then-retry path as every other call.
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false });
    });

    it('returns the signed-in shopper', async () => {
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);
      const res = await request(app).get('/api/auth/me').set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        name: SHOPPER.name,
        email: SHOPPER.email,
        role: 'user',
        isBlocked: false
      });
    });

    it('never sends the password or OTP fields', async () => {
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);
      const res = await request(app).get('/api/auth/me').set('Cookie', cookies);

      for (const field of ['password', 'otpHash', 'otpExpiresAt', 'googleId', 'facebookId']) {
        expect(res.body.user).not.toHaveProperty(field);
      }
    });

    it('is not served on the bare path - /api is the only mount', async () => {
      // Signed in, so a working endpoint here would be unmistakable. Since 5.5
      // removed the duplicate bare mounts this path reaches the SPA fallback
      // instead of the endpoint, so the assertion is that it does not answer
      // as the endpoint rather than that it is absent from the routing table.
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

      const res = await request(app).get('/auth/me').set('Cookie', cookies);

      expect(res.body?.user).toBeUndefined();
    });
  });

  /**
   * The SPA sends everything through an /api base URL.
   *
   * This router is root-mounted and declares its own '/api/...' paths. They
   * only ever existed on their bare paths at first, so every one was a 404
   * under /api - which meant the React auth pages, and the refresh
   * interceptor, could not reach the server at all. Phase 5.5 removed the bare
   * variants, leaving exactly one URL per endpoint.
   *
   * Mocked HTTP in the frontend tests cannot catch that: the mock answers
   * whatever path it is given. Only asserting against the real router does.
   */
  describe('/api parity', () => {
    it.each([
      '/api/login',
      '/api/signup',
      '/api/verify-otp',
      '/api/resend-otp',
      '/api/forgot-password',
      '/api/reset-otp',
      '/api/resend-reset-otp',
      '/api/reset-password',
      '/api/auth/refresh'
    ])('%s is routed', async (path) => {
      const res = await request(app).post(path).send({});

      // Status alone cannot distinguish these: several handlers answer 404
      // themselves for an empty body - "No account with that email" is one.
      // An unrouted path produces Express's own "Cannot POST /x", which it
      // renders as HTML rather than JSON, so the raw text is what to check.
      expect(res.text ?? '').not.toMatch(/Cannot POST/);
    });

    it('would notice an unrouted path (control for the assertion above)', async () => {
      const res = await request(app).post('/api/definitely-not-routed').send({});
      expect(res.text ?? '').toMatch(/Cannot POST/);
    });

    it('logs in over the /api path', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ email: SHOPPER.email, password: SHOPPER.password });

      expect(res.status).toBe(200);
    });

    it('routes a real login through the /api path too', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ email: SHOPPER.email, password: SHOPPER.password });

      expect(res.status).toBe(200);
      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.some((c) => c.startsWith('user_at='))).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('answers with JSON, not a redirect an XHR client would discard', async () => {
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);
      const res = await request(app).post('/api/auth/logout').set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
    });

    it('clears both cookies, so the browser stops sending them', async () => {
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);
      const res = await request(app).post('/api/auth/logout').set('Cookie', cookies);

      const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cleared.some((c) => /^user_at=;/.test(c))).toBe(true);
      expect(cleared.some((c) => /^user_rt=;/.test(c))).toBe(true);
    });

    /**
     * Worth stating explicitly, because it is the one thing logout cannot do.
     *
     * A JWT cannot be un-issued. Logout revokes the refresh token row and
     * clears the cookies, so a real browser is signed out immediately - but an
     * access token captured beforehand stays valid until it expires. That is
     * why shopper access tokens last 20 minutes rather than days, and why the
     * refresh token is the thing that gets revoked.
     */
    it('cannot invalidate an access token that was already issued', async () => {
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

      await request(app).post('/api/auth/logout').set('Cookie', cookies);

      // Replaying the cleared cookie still works until the token expires.
      const replayed = await request(app).get('/api/auth/me').set('Cookie', cookies);
      expect(replayed.status).toBe(200);

      // But the refresh token is dead, so the session cannot be extended.
      const refresh = await request(app).post('/api/auth/refresh').set('Cookie', cookies);
      expect(refresh.status).toBe(401);
    });

    it('revokes the refresh token, so it cannot be replayed', async () => {
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

      await request(app).post('/api/auth/logout').set('Cookie', cookies);

      const replay = await request(app).post('/api/auth/refresh').set('Cookie', cookies);
      expect(replay.status).toBe(401);
    });

    it('is harmless when nobody is signed in', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/admin/auth/logout', () => {
    it('ends the admin session and revokes its refresh token', async () => {
      const cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);

      const res = await request(app).post('/api/admin/auth/logout').set('Cookie', cookies);
      expect(res.status).toBe(200);

      const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cleared.some((c) => /^admin_at=;/.test(c))).toBe(true);
      expect(cleared.some((c) => /^admin_rt=;/.test(c))).toBe(true);

      const refresh = await request(app).post('/api/admin/auth/refresh').set('Cookie', cookies);
      expect(refresh.status).toBe(401);
    });
  });

  describe('GET /api/admin/auth/me', () => {
    it('returns 401 when signed out', async () => {
      const res = await request(app).get('/api/admin/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the signed-in admin', async () => {
      const cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);
      const res = await request(app).get('/api/admin/auth/me').set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ email: ADMIN.email, role: 'admin' });
    });

    it('refuses a shopper session', async () => {
      // The two audiences are independent. A valid shopper cookie reaching an
      // admin route is not an admin, and must not be reported as signed in.
      const cookies = await signIn('/api/login', SHOPPER.email, SHOPPER.password);
      const res = await request(app).get('/api/admin/auth/me').set('Cookie', cookies);

      expect(res.status).toBe(401);
    });

    it('is no longer reachable on its historic bare mount', async () => {
      // The admin router used to be mounted twice. 5.5 removed the bare copy,
      // so every endpoint now answers on exactly one URL.
      const cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);
      const res = await request(app).get('/admin/auth/me').set('Cookie', cookies);

      expect(res.body?.user).toBeUndefined();
    });
  });
});
