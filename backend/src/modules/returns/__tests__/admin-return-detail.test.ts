import mongoose from 'mongoose';
import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';
import Product from '../../catalog/product.model';
import Category from '../../catalog/category.model';
import Brand from '../../catalog/brand.model';
import Return from '../return.model';

/**
 * GET /api/admin/returns/api/:returnId, and the reject contract the page relies on.
 *
 * The returns list was the only way to see a return request, so the detail
 * page needed an endpoint of its own. It answers to both the readable
 * `RET000001` the page links with and the `_id` the approve and reject routes
 * take, so neither caller has to translate.
 */

const ADMIN = {
  name: 'Returns Admin',
  email: 'returns-admin@example.com',
  password: 'CorrectHorse1!',
  role: 'admin' as const
};

const SHOPPER = {
  name: 'Returns Shopper',
  email: 'returns-shopper@example.com',
  password: 'CorrectHorse1!'
};

const signIn = async (path: string, email: string, password: string): Promise<string[]> => {
  const res = await request(app).post(path).type('form').send({ email, password });
  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

describe('admin return detail', () => {
  let cookies: string[];
  let returnObjectId: string;
  let readableId: string;

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
      Brand.deleteMany({}),
      Return.deleteMany({})
    ]);

    await User.create({ ...ADMIN, isVerified: true });
    const shopper = await User.create({ ...SHOPPER, isVerified: true });

    const brand = await Brand.create({ name: 'Returnwear' });
    const category = await Category.create({ name: 'Court' });

    const product = await Product.create({
      productName: 'Return Test Shoe',
      slug: 'return-test-shoe',
      description: 'For the return detail test.',
      features: 'Stiff, Flat',
      brand: brand._id,
      category: category._id,
      regularPrice: 2000,
      mainImage: '/uploads/return-test.jpg',
      variants: [{ size: 'UK 8', stock: 3, basePrice: 1500, sku: 'RTS-8' }]
    });

    const created = await Return.create({
      orderId: 'ORD000123',
      itemId: new mongoose.Types.ObjectId(),
      userId: shopper._id,
      productId: product._id,
      productName: 'Return Test Shoe',
      productImage: '/uploads/return-test.jpg',
      sku: 'RTS-8',
      size: 'UK 8',
      quantity: 1,
      price: 1500,
      totalPrice: 1500,
      reason: 'Size too small'
    });

    returnObjectId = String(created._id);
    readableId = created.returnId;

    cookies = await signIn('/api/admin/login', ADMIN.email, ADMIN.password);
  });

  it('finds a return by its readable id, with the customer and product attached', async () => {
    const res = await request(app)
      .get(`/api/admin/returns/api/${readableId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.return).toMatchObject({
      returnId: readableId,
      status: 'Pending',
      reason: 'Size too small',
      totalPrice: 1500,
      userId: { name: SHOPPER.name, email: SHOPPER.email },
      productId: { productName: 'Return Test Shoe' }
    });
  });

  it('finds the same return by its _id', async () => {
    const res = await request(app)
      .get(`/api/admin/returns/api/${returnObjectId}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.data.return.returnId).toBe(readableId);
  });

  it('sends a null order rather than failing when the order is gone', async () => {
    const res = await request(app)
      .get(`/api/admin/returns/api/${readableId}`)
      .set('Cookie', cookies);

    expect(res.body.data.order).toBeNull();
  });

  it('answers a return that does not exist with a 404', async () => {
    const missing = await request(app)
      .get('/api/admin/returns/api/RET999999')
      .set('Cookie', cookies);

    expect(missing.status).toBe(404);
    expect(missing.body).toMatchObject({ success: false });
  });

  it('still routes /api/filtered to the list, not to the detail', async () => {
    const res = await request(app).get('/api/admin/returns/api/filtered').set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.returns)).toBe(true);
  });

  it('is not readable with a shopper session', async () => {
    const shopper = await signIn('/api/login', SHOPPER.email, SHOPPER.password);

    const res = await request(app)
      .get(`/api/admin/returns/api/${readableId}`)
      .set('Cookie', shopper);

    expect(res.status).not.toBe(200);
  });

  it('reads the rejection reason from `rejectionReason`, which is what the admin must send', async () => {
    // The admin UI sent `{ reason }`, which this refuses - so every rejection
    // from the React panel failed. Pinned so the key cannot drift again.
    const res = await request(app)
      .patch(`/api/admin/returns/${returnObjectId}/reject`)
      .set('Cookie', cookies)
      .send({ reason: 'Item shows signs of wear' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/rejection reason/i);
  });
});
