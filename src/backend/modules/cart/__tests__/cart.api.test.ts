import request from 'supertest';
import * as db from '../../../common/testing/db';
import app from '../../../app';
import User from '../../users/user.model';
import Cart from '../cart.model';
import Product from '../../catalog/product.model';
import { createTestProduct } from '../../../common/testing/test-data';

/**
 * The cart over HTTP.
 *
 * Covers the two things step 5 changed on the backend: the cart assembly was
 * extracted so the EJS page and the SPA share one implementation, and the
 * dual-mounted route now answers HTML or JSON depending on which mount the
 * request arrived on.
 *
 * The assembly is worth testing directly because it is more than a read - it
 * re-prices stale items and partitions the cart into three buckets, and the
 * page's totals depend on that partitioning being right.
 */

const SHOPPER = {
  name: 'Cart Shopper',
  email: 'cart-shopper@example.com',
  password: 'CorrectHorse1!'
};

const signIn = async (): Promise<string[]> => {
  const res = await request(app)
    .post('/login')
    .type('form')
    .send({ email: SHOPPER.email, password: SHOPPER.password });

  return ([] as string[]).concat(res.headers['set-cookie'] ?? []);
};

describe('cart API', () => {
  let cookies: string[];
  let product: any;
  let userId: any;

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    await Cart.deleteMany({});

    const user = await User.create({ ...SHOPPER, isVerified: true });
    userId = user._id;

    product = await createTestProduct('Cart Test Shoe');
    cookies = await signIn();
  });

  describe('content negotiation', () => {
    it('answers JSON on both mounts now the page render is gone', async () => {
      // Until Phase 5 the bare path rendered EJS and only /api answered data.
      // Both are the same JSON endpoint now; the bare mount disappears with
      // the duplicate mounts in 5.5.
      for (const path of ['/cart', '/api/cart']) {
        const res = await request(app).get(path).set('Cookie', cookies);

        expect(res.headers['content-type']).toMatch(/json/);
        expect(res.body).toHaveProperty('cartItems');
      }
    });

    it('answers a signed-out client with 401 rather than a redirect', async () => {
      const page = await request(app).get('/cart');
      expect(page.status).toBe(401);

      const data = await request(app).get('/api/cart');
      expect(data.status).toBe(401);
      expect(data.headers['content-type']).toMatch(/json/);
    });
  });

  describe('GET /api/cart', () => {
    it('returns empty buckets for a new shopper', async () => {
      const res = await request(app).get('/api/cart').set('Cookie', cookies);

      expect(res.status).toBe(200);
      expect(res.body.cartItems).toEqual([]);
      expect(res.body.availableCartItems).toEqual([]);
      expect(res.body.outOfStockCartItems).toEqual([]);
      expect(res.body.unavailableCartItems).toEqual([]);
    });

    it('puts a normal item in the available bucket', async () => {
      const variant = product.variants[0];

      await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id), quantity: 2 });

      const res = await request(app).get('/api/cart').set('Cookie', cookies);

      expect(res.body.availableCartItems).toHaveLength(1);
      expect(res.body.availableCartItems[0]).toMatchObject({ quantity: 2, size: variant.size });
      expect(res.body.outOfStockCartItems).toHaveLength(0);
    });

    it('moves an item to the out-of-stock bucket when its variant sells out', async () => {
      const variant = product.variants[0];

      await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id) });

      // The size sells out after it was added to the cart.
      await Product.updateOne(
        { _id: product._id, 'variants._id': variant._id },
        { $set: { 'variants.$.stock': 0 } }
      );

      const res = await request(app).get('/api/cart').set('Cookie', cookies);

      expect(res.body.availableCartItems).toHaveLength(0);
      expect(res.body.outOfStockCartItems).toHaveLength(1);
      expect(res.body.outOfStockCartItems[0].isOutOfStock).toBe(true);
    });

    it('moves an item to the unavailable bucket when the product is unlisted, with a reason', async () => {
      const variant = product.variants[0];

      await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id) });

      await Product.updateOne({ _id: product._id }, { $set: { isListed: false } });

      const res = await request(app).get('/api/cart').set('Cookie', cookies);

      expect(res.body.unavailableCartItems).toHaveLength(1);
      expect(res.body.unavailableCartItems[0]).toMatchObject({
        isUnavailable: true,
        unavailableReason: 'Product unavailable'
      });
    });

    it('re-prices an item whose offer moved since it was added', async () => {
      // This is why the client must not cache a price of its own: the cart is
      // re-costed on every read, not stored at the price it went in at.
      const variant = product.variants[0];

      await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id), quantity: 2 });

      const before = await request(app).get('/api/cart').set('Cookie', cookies);
      const originalPrice = before.body.availableCartItems[0].price;

      await Product.updateOne({ _id: product._id }, { $set: { productOffer: 50 } });

      const after = await request(app).get('/api/cart').set('Cookie', cookies);
      const item = after.body.availableCartItems[0];

      expect(item.price).toBeLessThan(originalPrice);
      expect(item.totalPrice).toBeCloseTo(item.price * item.quantity, 2);
    });

    it('drops an item whose product has been deleted outright', async () => {
      const variant = product.variants[0];

      await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id) });

      await Product.deleteOne({ _id: product._id });

      const res = await request(app).get('/api/cart').set('Cookie', cookies);

      expect(res.body.cartItems).toHaveLength(0);

      // And it is gone from the stored cart, not just filtered from the view.
      const stored = await Cart.findOne({ userId });
      expect(stored?.items).toHaveLength(0);
    });
  });

  describe('quantity rules', () => {
    it('refuses more than the five-per-variant cap', async () => {
      const variant = product.variants[0];

      await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id), quantity: 5 });

      const res = await request(app)
        .post('/api/cart/update')
        .set('Cookie', cookies)
        .send({
          productId: String(product._id),
          variantId: String(variant._id),
          quantity: 6
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('refuses more than the stock available, and says how many there are', async () => {
      const variant = product.variants[0];

      await Product.updateOne(
        { _id: product._id, 'variants._id': variant._id },
        { $set: { 'variants.$.stock': 2 } }
      );

      const res = await request(app)
        .post('/api/cart/add')
        .set('Cookie', cookies)
        .send({ productId: String(product._id), variantId: String(variant._id), quantity: 4 });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('INSUFFICIENT_STOCK');
      expect(res.body.message).toMatch(/2/);
    });
  });
});
