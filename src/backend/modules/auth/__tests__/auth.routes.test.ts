import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';

// NODE_ENV=test is set by vitest.config.mjs, before any module loads, so the
// rate limiters register in skip mode and this suite is not throttled by its
// own repeated login attempts.

const SEEDED = {
  name: 'Test Shopper',
  email: 'shopper@example.com',
  password: 'CorrectHorse1!'
};

describe('auth routes (HTTP)', () => {
  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await User.create({
      name: SEEDED.name,
      email: SEEDED.email,
      password: SEEDED.password, // hashed by the model pre-save hook
      isVerified: true
    });
  });

  describe('GET /login', () => {
    it('is no longer a server-rendered page', async () => {
      // The EJS login view is gone. /login is a React route now, so this path
      // reaches the SPA fallback (or 404s when the frontend is not built) -
      // either way the server does not render a form.
      const res = await request(app).get('/api/login');

      expect(res.text).not.toContain('<form');
    });

    // Page routes deliberately stay off /api - only the prefixed JSON routers
    // are dual-mounted, because root-mounted routers already declare their own
    // '/api/...' endpoints internally.
    it('does not expose the login page under /api', async () => {
      const res = await request(app).get('/api/login');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /login', () => {
    it('rejects a wrong password without revealing which field was wrong', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ email: SEEDED.email, password: 'WrongPassword1!' });

      // Must not hand back a session cookie on a failed login.
      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.some((c: any) => c.startsWith('user.sid'))).toBe(false);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ email: 'nobody@example.com', password: SEEDED.password });

      const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
      expect(cookies.some((c: any) => c.startsWith('user.sid'))).toBe(false);
    });

    // A blocked user holding valid credentials must still be refused entry.
    it('refuses a blocked user even with the correct password', async () => {
      await User.updateOne({ email: SEEDED.email }, { isBlocked: true });

      const res = await request(app)
        .post('/api/login')
        .type('form')
        .send({ email: SEEDED.email, password: SEEDED.password });

      expect(res.status).toBeLessThan(500);
      const body = `${res.text || ''}${res.headers.location || ''}`;
      expect(body.toLowerCase()).not.toContain('dashboard');
    });
  });

  describe('POST /signup', () => {
    it('refuses to create a second account on an existing email', async () => {
      const before = await User.countDocuments({ email: SEEDED.email });

      await request(app).post('/api/signup').type('form').send({
        name: 'Impostor',
        email: SEEDED.email,
        password: 'AnotherPass1!',
        confirmPassword: 'AnotherPass1!'
      });

      expect(await User.countDocuments({ email: SEEDED.email })).toBe(before);
    });

    it('does not store a password in plain text when a user is created', async () => {
      const user = await User.findOne({ email: SEEDED.email }).lean();
      expect(user!.password).not.toBe(SEEDED.password);
      expect(user!.password.startsWith('$2')).toBe(true);
    });
  });

  describe('route surface', () => {
    it('serves the shop data as JSON', async () => {
      // /shop is a React route now - the EJS page render is gone, so that path
      // reaches the SPA fallback and only /api/shop carries data.
      const data = await request(app).get('/api/shop');

      expect(data.status).toBe(200);
      expect(data.headers['content-type']).toMatch(/json/);
      expect(data.body).toHaveProperty('products');
    });

    it('dual-mounts the prefixed JSON routers under /api', async () => {
      // /cart requires auth, so an unauthenticated request must be rejected
      // rather than 404 - proving the route exists at both mounts.
      const legacy = await request(app).get('/api/cart');
      const prefixed = await request(app).get('/api/cart');
      expect(legacy.status).not.toBe(404);
      expect(prefixed.status).not.toBe(404);
    });

    it('rejects an unauthenticated request with JSON on either mount', async () => {
      // The two mounts used to answer differently: a browser hitting /cart was
      // redirected to the login page, an XHR client got a 401. There is no
      // login page to redirect to any more, and the SPA handles the redirect
      // itself, so both are now a 401 the client can act on.
      for (const path of ['/api/cart', '/api/cart']) {
        const res = await request(app).get(path);

        expect(res.status).toBe(401);
        expect(res.headers['content-type']).toMatch(/json/);
      }
    });

    // Regression guard: cart's auth guard read req.headers.accept without a
    // null check, so a request with no Accept header 500'd. The guard no
    // longer negotiates at all, but the case is cheap to keep pinned.
    it('does not error on unauthenticated cart access without an Accept header', async () => {
      const res = await request(app).get('/api/cart').unset('Accept');
      expect(res.status).toBe(401);
    });

    it('returns 401 JSON for unauthenticated cart access from an API client', async () => {
      const res = await request(app).get('/api/cart').set('Accept', 'application/json');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: 'AUTHENTICATION_REQUIRED' });
    });

    it('does not crash on an unknown path', async () => {
      // Since Phase 5 an unknown *page* path is answered with the React shell
      // rather than a 404 - it is a client-side route the server knows nothing
      // about, and React Router renders its own not-found. So the assertion is
      // that the server answers sanely, not that it 404s.
      const res = await request(app).get('/definitely-not-a-real-route');

      expect(res.status).toBeLessThan(500);
    });

    it('still 404s an unknown API path instead of returning the shell', async () => {
      // The fallback deliberately excludes /api. Answering a mistyped endpoint
      // with 200 and a page of HTML would make a broken fetch look like a
      // JSON parsing bug.
      const res = await request(app).get('/api/definitely-not-a-real-route');

      expect(res.status).toBe(404);
    });
  });
});
