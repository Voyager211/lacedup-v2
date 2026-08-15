import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';

/**
 * The shapes the dashboard endpoints actually return.
 *
 * This exists because the React dashboard was written against invented shapes
 * and its own tests mocked those inventions, so the suite was green while the
 * page threw on first paint: `/api/sales` sends `{ labels, salesData }` - two
 * parallel arrays - and the component mapped over it as if it were a list of
 * points.
 *
 * A frontend test cannot catch that; axios-mock-adapter returns whatever it is
 * handed. Only asserting against the real router can. So these are contract
 * tests: they pin the envelope each endpoint uses and the keys the client
 * reads, and they fail if either side drifts.
 *
 * They deliberately run against an empty database. The envelope - object
 * versus array, and which key holds the name - is what broke, and that is
 * visible with no data at all.
 */

const ADMIN = {
  name: 'Dashboard Admin',
  email: 'dashboard-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

const RANKED = [
  ['/api/admin/dashboard/api/best-selling-products', 'productName'],
  ['/api/admin/dashboard/api/best-selling-categories', 'categoryName'],
  ['/api/admin/dashboard/api/best-selling-brands', 'brandName']
] as const;

describe('dashboard response contract', () => {
  let cookies: string[];

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await User.create(ADMIN);

    const res = await request(app)
      .post('/api/admin/login')
      .type('form')
      .send({ email: ADMIN.email, password: ADMIN.password });

    cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  });

  const get = (path: string) => request(app).get(path).set('Cookie', cookies);

  it('wraps every endpoint in { success, data }', async () => {
    const paths = [
      '/api/admin/dashboard/api/stats',
      '/api/admin/dashboard/api/sales',
      '/api/admin/dashboard/api/revenue-distribution',
      ...RANKED.map(([path]) => path)
    ];

    for (const path of paths) {
      const res = await get(path);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    }
  });

  it('reports the four figures the stat cards read', async () => {
    const res = await get('/api/admin/dashboard/api/stats');

    expect(res.body.data).toMatchObject({
      totalCustomers: expect.any(Number),
      totalOrders: expect.any(Number),
      totalRevenue: expect.any(Number),
      pendingOrders: expect.any(Number)
    });
  });

  it('has no product count, whatever a stat card might want', async () => {
    // The dashboard shipped with a "Products" card reading this. It was always
    // zero, because the endpoint has never sent it.
    const res = await get('/api/admin/dashboard/api/stats');

    expect(res.body.data).not.toHaveProperty('totalProducts');
  });

  it('sends sales as two parallel arrays, not a list of points', async () => {
    // The exact shape that crashed the page.
    const res = await get('/api/admin/dashboard/api/sales');

    expect(Array.isArray(res.body.data)).toBe(false);
    expect(Array.isArray(res.body.data.labels)).toBe(true);
    expect(Array.isArray(res.body.data.salesData)).toBe(true);
  });

  it('keeps the sales arrays the same length, so they can be zipped', async () => {
    const res = await get('/api/admin/dashboard/api/sales');

    expect(res.body.data.labels).toHaveLength(res.body.data.salesData.length);
    // Twelve buckets for every period; empty data means zeros, not an empty array.
    expect(res.body.data.labels.length).toBeGreaterThan(0);
  });

  it.each(['weekly', 'monthly', 'yearly'])('holds that shape for period=%s', async (period) => {
    const res = await get(`/api/admin/dashboard/api/sales?period=${period}`);

    expect(Array.isArray(res.body.data.labels)).toBe(true);
    expect(res.body.data.labels).toHaveLength(res.body.data.salesData.length);
  });

  it('sends the revenue split as an array', async () => {
    const res = await get('/api/admin/dashboard/api/revenue-distribution');

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it.each(RANKED)('sends %s as an array', async (path) => {
    const res = await get(path);

    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
