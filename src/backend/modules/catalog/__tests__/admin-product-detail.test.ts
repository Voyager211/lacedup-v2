import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';
import Product from '../product.model';
import Category from '../category.model';
import Brand from '../brand.model';

/**
 * GET /api/admin/products/:id.
 *
 * The admin product detail page had no JSON branch - it only ever rendered
 * `admin/product-detail.ejs`. The React page needs the same data, and in
 * particular needs the *computed* fields the controller adds and the schema
 * does not store: each variant's winning offer and the price it produces.
 *
 * If those ever stopped being sent the page would silently fall back to base
 * prices and disagree with the storefront, so they are asserted directly.
 */

const ADMIN = {
  name: 'Catalog Admin',
  email: 'catalog-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

const SHOPPER = {
  name: 'Catalog Shopper',
  email: 'catalog-shopper@example.com',
  password: 'CorrectHorse1!'
};

const signIn = async (path: string, email: string, password: string): Promise<string[]> => {
  const res = await request(app).post(path).type('form').send({ email, password });
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

describe('admin product detail as JSON', () => {
  let productId: string;
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
      Product.deleteMany({}),
      Category.deleteMany({}),
      Brand.deleteMany({})
    ]);

    await User.create({ ...ADMIN, isVerified: true });
    await User.create({ ...SHOPPER, isVerified: true });

    // The brand offer is the largest, so it should win over the product's own.
    const brand = await Brand.create({ name: 'Testwear', brandOffer: 20 });
    const category = await Category.create({ name: 'Running', categoryOffer: 5 });

    const product = await Product.create({
      productName: 'Detail Test Shoe',
      slug: 'detail-test-shoe',
      description: 'For the detail page test.',
      // A required comma-separated String on the schema, not an array.
      features: 'Breathable, Cushioned',
      brand: brand._id,
      category: category._id,
      regularPrice: 12000,
      productOffer: 10,
      mainImage: '/uploads/main.jpg',
      subImages: ['/uploads/sub1.jpg', '/uploads/sub2.jpg'],
      variants: [{ size: 'UK 8', stock: 10, basePrice: 10000, sku: 'DTS-8' }]
    });

    productId = String(product._id);
    cookies = await signIn('/admin/login', ADMIN.email, ADMIN.password);
  });

  it('is routed under /api at all', async () => {
    const res = await request(app).get(`/api/admin/products/${productId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('resolves the winning offer per variant rather than leaving it to the client', async () => {
    const res = await request(app).get(`/api/admin/products/${productId}`).set('Cookie', cookies);

    const variant = res.body.product.variants[0];

    expect(variant.appliedOffer).toBe(20);
    expect(variant.offerSource).toBe('Brand');
    expect(variant.calculatedFinalPrice).toBe(8000);
  });

  it('lists the competing offers, highest first', async () => {
    const res = await request(app).get(`/api/admin/products/${productId}`).set('Cookie', cookies);

    const values = res.body.activeOffers.map((offer: { value: number }) => offer.value);

    expect(values).toEqual([20, 10, 5]);
  });

  it('assembles the image list with the main image first', async () => {
    const res = await request(app).get(`/api/admin/products/${productId}`).set('Cookie', cookies);

    expect(res.body.allImages).toEqual([
      '/uploads/main.jpg',
      '/uploads/sub1.jpg',
      '/uploads/sub2.jpg'
    ]);
  });

  it('answers a missing product with JSON, not a render that would throw', async () => {
    // `views/error.ejs` does not exist, so the HTML branch throws inside its
    // own catch. The JSON branch is what keeps a 404 a 404.
    const missing = '507f1f77bcf86cd799439011';

    const res = await request(app).get(`/api/admin/products/${missing}`).set('Cookie', cookies);

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false });
  });

  it('is not readable with a shopper session', async () => {
    const shopper = await signIn('/login', SHOPPER.email, SHOPPER.password);

    const res = await request(app).get(`/api/admin/products/${productId}`).set('Cookie', shopper);

    expect(res.status).not.toBe(200);
  });

  it('still renders HTML on the bare admin path', async () => {
    // The EJS page is still mounted until Phase 5 removes it.
    const res = await request(app).get(`/admin/products/${productId}`).set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
