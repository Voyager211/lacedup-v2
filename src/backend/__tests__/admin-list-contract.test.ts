import request from 'supertest';
import * as db from '../common/testing/db';
import app from '../app';
import User from '../modules/users/user.model';
import Coupon from '../modules/coupons/coupon.model';
import Category from '../modules/catalog/category.model';
import Brand from '../modules/catalog/brand.model';

/**
 * The shapes the four admin list endpoints return.
 *
 * The React admin drives products, categories, brands and coupons through one
 * `<ResourceListPage>`, which means one normaliser has to understand all four
 * responses. They are not the same:
 *
 *   categories  { categories, currentPage, totalPages, totalRecords }
 *   brands      { brands,     currentPage, totalPages, totalRecords }
 *   products    { products,   currentPage, totalPages, totalRecords }
 *   coupons     { success, message, data: { coupons, count, totalCount,
 *                                           pagination: { currentPage, … } } }
 *
 * Coupons nests everything a level deeper, and the normaliser only read the top
 * level - so it found `data`, an object rather than an array, and the page
 * rendered nothing at all.
 *
 * Frontend tests could not catch it: the mock returns whatever it is handed.
 * These assert against the real router, so the difference is stated once, here,
 * and a change on either side fails loudly.
 */

const ADMIN = {
  name: 'List Admin',
  email: 'list-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

describe('admin list response contract', () => {
  let cookies: string[];

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([
      User.deleteMany({}),
      Coupon.deleteMany({}),
      Category.deleteMany({}),
      Brand.deleteMany({})
    ]);

    const admin = await User.create(ADMIN);
    await Category.create({ name: 'Running' });
    await Brand.create({ name: 'Testwear' });
    await Coupon.create({
      code: 'SAVE20',
      name: '20% off',
      discountType: 'percentage',
      discountValue: 20,
      validFrom: new Date(Date.now() - 1000),
      validTo: new Date(Date.now() + 86_400_000),
      minimumOrderValue: 500,
      // Required by the schema; the real create route fills it from the session.
      createdBy: admin._id
    });

    const res = await request(app)
      .post('/api/admin/login')
      .type('form')
      .send({ email: ADMIN.email, password: ADMIN.password });

    cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  });

  const get = (path: string) => request(app).get(path).set('Cookie', cookies);

  it.each([
    ['/api/admin/categories/api', 'categories'],
    ['/api/admin/brands/api', 'brands'],
    ['/api/admin/products/api', 'products']
  ])('%s returns its rows and paging at the top level', async (path, key) => {
    const res = await get(path);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body[key])).toBe(true);
    expect(res.body).toHaveProperty('currentPage');
    expect(res.body).toHaveProperty('totalPages');
  });

  it('coupons nests its rows under data, unlike the other three', async () => {
    // The difference the normaliser exists to absorb. Asserted directly so it
    // cannot change without something failing.
    const res = await get('/api/admin/coupons/api');

    expect(res.status).toBe(200);
    expect(res.body).not.toHaveProperty('coupons');
    expect(Array.isArray(res.body.data.coupons)).toBe(true);
  });

  it('coupons puts paging under data.pagination', async () => {
    const res = await get('/api/admin/coupons/api');

    expect(res.body.data.pagination).toMatchObject({
      currentPage: expect.any(Number),
      totalPages: expect.any(Number)
    });
    // Its own name for the total; the other three call it totalRecords.
    expect(res.body.data).toHaveProperty('totalCount');
  });

  it('actually returns the coupon that exists', async () => {
    // Guards the case the bug produced: a 200 with rows the client cannot find.
    const res = await get('/api/admin/coupons/api');

    expect(res.body.data.coupons).toHaveLength(1);
    expect(res.body.data.coupons[0]).toMatchObject({ code: 'SAVE20' });
  });

  it('nests the states/districts map under data too', async () => {
    /*
     * Public, so no cookie needed. Pinned here because the client sorts the
     * state list with localeCompare: without unwrapping `data`, Object.values
     * also returned the `success` boolean and reading `.name` off it threw,
     * which took the whole checkout page down.
     */
    const res = await request(app).get('/api/states-districts');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);

    const entries = Object.values(res.body.data as Record<string, { name: string }>);
    expect(entries.length).toBeGreaterThan(0);
    // Every value is a real entry - nothing in here is a stray flag.
    for (const entry of entries) expect(typeof entry.name).toBe('string');
  });

  it('nests a single coupon under data.coupon too', async () => {
    const list = await get('/api/admin/coupons/api');
    const id = list.body.data.coupons[0]._id;

    const res = await get(`/api/admin/coupons/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.coupon).toMatchObject({ code: 'SAVE20' });
  });
});
