import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';

/**
 * The orders API surface.
 *
 * This router is root-mounted and deliberately not dual-mounted, so its routes
 * only ever existed on their bare paths - every one was a 404 under the /api
 * base URL the SPA uses. That is the second time the same gap has appeared
 * (the auth routes were the first), which is why it now has a test rather than
 * just a fix.
 *
 * Frontend tests cannot catch this: a mocked adapter answers whatever path it
 * is given, so the suite stays green against endpoints that do not exist.
 */

const SHOPPER = {
  name: 'Orders Shopper',
  email: 'orders-shopper@example.com',
  password: 'CorrectHorse1!'
};

const signIn = async (): Promise<string[]> => {
  const res = await request(app)
    .post('/api/login')
    .type('form')
    .send({ email: SHOPPER.email, password: SHOPPER.password });

  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

describe('orders /api surface', () => {
  let cookies: string[];

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await User.create({ ...SHOPPER, isVerified: true });
    cookies = await signIn();
  });

  it.each([
    '/api/orders',
    '/api/orders/filtered',
    '/api/orders/search',
    '/api/orders/ORD000123'
  ])('%s is routed', async (path) => {
    const res = await request(app).get(path).set('Cookie', cookies);

    // An unrouted path produces Express's own "Cannot GET /x" as HTML. The
    // status itself is not the signal - a real order id that does not exist
    // legitimately 404s.
    expect(res.text ?? '').not.toMatch(/Cannot GET/);
  });

  it('would notice an unrouted path (control for the assertion above)', async () => {
    const res = await request(app).get('/api/orders-not-a-real-route').set('Cookie', cookies);
    expect(res.text ?? '').toMatch(/Cannot GET/);
  });

  it('does not let /:orderId swallow the literal paths', async () => {
    // `/api/orders/filtered` must reach the filter handler, not be read as an
    // order whose id is the word "filtered". The filter handler answers with a
    // paginated shape; the details handler would 404.
    const res = await request(app).get('/api/orders/filtered').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('answers JSON on both mounts now the page render is gone', async () => {
    // Until Phase 5 the bare path rendered EJS and only /api answered data.
    // The bare mount itself disappears with the duplicate mounts in 5.5.
    for (const path of ['/api/orders', '/api/orders']) {
      const res = await request(app).get(path).set('Cookie', cookies);

      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('orders');
    }
  });

  it('sends the reason lists with the orders, rather than expecting a client copy', async () => {
    // They are a server enum - a mirrored copy would drift the moment one is
    // added, and the server rejects any reason outside its own list.
    const res = await request(app).get('/api/orders').set('Cookie', cookies);

    expect(Array.isArray(res.body.cancellationReasons)).toBe(true);
    expect(res.body.cancellationReasons).toContain('Ordered by mistake');
    expect(Array.isArray(res.body.returnReasons)).toBe(true);
  });

  it('answers a signed-out client with 401 on either mount', async () => {
    const page = await request(app).get('/api/orders');
    expect(page.status).toBe(401);

    const data = await request(app).get('/api/orders');
    expect(data.status).toBe(401);
    expect(data.headers['content-type']).toMatch(/json/);
  });
});
