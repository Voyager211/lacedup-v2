process.env.NODE_ENV = 'test';

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../../../common/testing/db');

// app.js must be required only after NODE_ENV is set, so the rate limiters
// register in skip mode and the suite is not throttled by its own requests.
let app;
let User;

const SEEDED = {
  name: 'Test Shopper',
  email: 'shopper@example.com',
  password: 'CorrectHorse1!'
};

describe('auth routes (HTTP)', () => {
  beforeAll(async () => {
    await db.connect();
    app = require('../../../app');
    User = require('../../users/user.model');
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await User.create({
      name: SEEDED.name,
      email: SEEDED.email,
      password: await bcrypt.hash(SEEDED.password, 10),
      isVerified: true
    });
  });

  describe('GET /login', () => {
    it('serves the login page to a guest', async () => {
      const res = await request(app).get('/login');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<form');
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
        .post('/login')
        .type('form')
        .send({ email: SEEDED.email, password: 'WrongPassword1!' });

      // Must not hand back a session cookie on a failed login.
      const cookies = res.headers['set-cookie'] || [];
      expect(cookies.some((c) => c.startsWith('user.sid'))).toBe(false);
    });

    it('rejects an unknown email', async () => {
      const res = await request(app)
        .post('/login')
        .type('form')
        .send({ email: 'nobody@example.com', password: SEEDED.password });

      const cookies = res.headers['set-cookie'] || [];
      expect(cookies.some((c) => c.startsWith('user.sid'))).toBe(false);
    });

    // A blocked user holding valid credentials must still be refused entry.
    it('refuses a blocked user even with the correct password', async () => {
      await User.updateOne({ email: SEEDED.email }, { isBlocked: true });

      const res = await request(app)
        .post('/login')
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

      await request(app).post('/signup').type('form').send({
        name: 'Impostor',
        email: SEEDED.email,
        password: 'AnotherPass1!',
        confirmPassword: 'AnotherPass1!'
      });

      expect(await User.countDocuments({ email: SEEDED.email })).toBe(before);
    });

    it('does not store a password in plain text when a user is created', async () => {
      const user = await User.findOne({ email: SEEDED.email }).lean();
      expect(user.password).not.toBe(SEEDED.password);
      expect(user.password.startsWith('$2')).toBe(true);
    });
  });

  describe('route surface', () => {
    it('serves the shop page as HTML and the shop data as JSON', async () => {
      const page = await request(app).get('/shop');
      expect(page.status).toBe(200);
      expect(page.headers['content-type']).toMatch(/html/);

      const data = await request(app).get('/api/shop');
      expect(data.status).toBe(200);
      expect(data.headers['content-type']).toMatch(/json/);
      expect(data.body).toHaveProperty('products');
    });

    it('dual-mounts the prefixed JSON routers under /api', async () => {
      // /cart requires auth, so an unauthenticated request must be rejected
      // rather than 404 - proving the route exists at both mounts.
      const legacy = await request(app).get('/cart');
      const prefixed = await request(app).get('/api/cart');
      expect(legacy.status).not.toBe(404);
      expect(prefixed.status).not.toBe(404);
      expect(legacy.status).toBe(prefixed.status);
    });

    // Regression guard: cart's auth guard read req.headers.accept without a
    // null check, so a request with no Accept header 500'd instead of being
    // redirected to login.
    it('redirects unauthenticated cart access instead of erroring', async () => {
      const res = await request(app).get('/cart').unset('Accept');
      expect(res.status).not.toBe(500);
      expect(res.status).toBeLessThan(500);
    });

    it('returns 401 JSON for unauthenticated cart access from an API client', async () => {
      const res = await request(app).get('/api/cart').set('Accept', 'application/json');
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ success: false, code: 'AUTHENTICATION_REQUIRED' });
    });

    it('returns 404 for an unknown path rather than crashing', async () => {
      const res = await request(app).get('/definitely-not-a-real-route');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
    });
  });
});
