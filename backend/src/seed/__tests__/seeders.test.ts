import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../../app';
import { PUBLIC_DIR } from '../../config/paths';
import { connect, disconnect } from '../../common/testing/db';
import Address from '../../modules/addresses/address.model';
import Coupon from '../../modules/coupons/coupon.model';
import Order from '../../modules/orders/order.model';
import Product from '../../modules/catalog/product.model';
import Referral from '../../modules/referrals/referral.model';
import Return from '../../modules/returns/return.model';
import Review from '../../modules/reviews/review.model';
import Transaction from '../../modules/wallet/transaction.model';
import User from '../../modules/users/user.model';
import Wallet from '../../modules/wallet/wallet.model';
import { SEED_EMAILS, SEED_PASSWORDS } from '../data/people';
import { slugOf } from '../data/catalog';
import { runSeed } from '../runner';
import { seeders } from '../seeders';

const silent = { log: () => {} };
const models = [...new Set(seeders.flatMap((seeder) => seeder.models))];
const countAll = () => Promise.all(models.map((model) => model.countDocuments()));

describe('seed data', () => {
  beforeAll(async () => {
    await connect();
    await runSeed(seeders, silent);
  });
  afterAll(disconnect);

  it('fills every seeded collection', async () => {
    for (const [index, count] of (await countAll()).entries()) {
      expect(count, models[index]!.modelName).toBeGreaterThan(0);
    }
  });

  it('adds nothing on a second run', async () => {
    const before = await countAll();
    await runSeed(seeders, silent);

    expect(await countAll()).toEqual(before);
  });

  it('builds products the way the pre-save hook would', async () => {
    for (const product of await Product.find().lean()) {
      expect(product.slug).toBe(slugOf(product.productName));
      expect(product.totalStock).toBe(product.variants.reduce((sum, v) => sum + v.stock, 0));
      for (const variant of product.variants) expect(variant.basePrice).toBeLessThan(product.regularPrice);
      for (const image of [product.mainImage, ...product.subImages]) {
        expect(fs.existsSync(path.join(PUBLIC_DIR, image)), image).toBe(true);
      }
    }
  });

  it('orders reference real users, variants and addresses, and add up', async () => {
    for (const order of await Order.find().lean()) {
      expect(await User.exists({ _id: order.user })).toBeTruthy();

      const book = await Address.findById(order.deliveryAddress.addressId).lean();
      expect(String(book?.userId)).toBe(String(order.user));
      expect(book?.address[order.deliveryAddress.addressIndex]).toBeDefined();

      for (const item of order.items) {
        const product = await Product.findById(item.productId).lean();
        const variant = product?.variants.find((v) => String(v._id) === String(item.variantId));
        expect(variant?.sku).toBe(item.sku);
        expect(variant?.size).toBe(item.size);
        expect(item.totalPrice).toBe(item.price * item.quantity);
      }

      expect(order.status).toBe(order.statusHistory.at(-1)?.status);
      expect(order.items.reduce((sum, i) => sum + i.totalPrice, 0)).toBe(order.amountAfterDiscount);
      expect(order.totalAmount).toBe(order.amountAfterDiscount + order.shipping - order.couponDiscount);
      if (order.paymentMethod === 'cod') expect(order.totalAmount).toBeLessThan(10_000);
    }
  });

  it('wallet balances match their transactions', async () => {
    for (const wallet of await Wallet.find().lean()) {
      let running = 0;
      for (const transaction of wallet.transactions) {
        running += transaction.type === 'credit' ? transaction.amount : -transaction.amount;
        expect(transaction.balanceAfter).toBe(running);
        expect(running).toBeGreaterThanOrEqual(0);
        if (transaction.orderId) expect(await Order.exists({ orderId: transaction.orderId })).toBeTruthy();
      }
      expect(wallet.balance).toBe(running);
    }
  });

  it('refunds every cancelled or returned prepaid order to the wallet', async () => {
    const refunded = await Order.find({ paymentStatus: 'Refunded' }).lean();
    expect(refunded.length).toBeGreaterThan(0);

    for (const order of refunded) {
      const wallet = await Wallet.findOne({ userId: order.user }).lean();
      expect(wallet?.transactions.some((t) => t.orderId === order.orderId && t.type === 'credit')).toBe(true);
    }
  });

  it('coupon usage matches the orders that used them', async () => {
    for (const coupon of await Coupon.find().lean()) {
      expect(coupon.usedCount).toBe(coupon.usedBy.length);
      if (coupon.usageLimit) expect(coupon.usedCount).toBeLessThanOrEqual(coupon.usageLimit);

      for (const use of coupon.usedBy) {
        const order = await Order.findById(use.orderId).lean();
        expect(String(order?.couponApplied)).toBe(String(coupon._id));
        expect(String(order?.user)).toBe(String(use.user));
      }
    }
  });

  it('returns point at order items in the matching state', async () => {
    for (const request of await Return.find().lean()) {
      const order = await Order.findOne({ orderId: request.orderId }).lean();
      const item = order?.items.find((i) => String(i._id) === String(request.itemId));

      expect(item?.status).toBe(request.status === 'Completed' ? 'Returned' : 'Processing Return');
    }
  });

  it('completed payment transactions never expire', async () => {
    const transactions = await Transaction.find().lean();
    expect(transactions.length).toBeGreaterThan(0);
    for (const transaction of transactions) expect(transaction.expiresAt ?? null).toBeNull();
  });

  it('verified reviews come from a delivered order for that product', async () => {
    for (const review of await Review.find({ isVerifiedPurchase: true }).lean()) {
      const delivered = await Order.exists({
        user: review.user,
        items: { $elemMatch: { productId: review.product, status: { $in: ['Delivered', 'Processing Return'] } } }
      });
      expect(delivered).toBeTruthy();
    }
  });

  it('referral counts match the referrals', async () => {
    for (const referral of await Referral.find().lean()) {
      const referrer = await User.findById(referral.referrer).lean();
      const referee = await User.findById(referral.referee).lean();

      expect(referrer?.referralCount).toBe(await Referral.countDocuments({ referrer: referral.referrer }));
      expect(String(referee?.referredBy)).toBe(String(referral.referrer));
      expect(referral.referralCode).toBe(referrer?.referralCode);
    }
  });

  describe('through the API', () => {
    it('fills the landing page', async () => {
      const res = await request(app).get('/api/home-sections');

      expect(res.status).toBe(200);
      expect(res.body.newArrivals.length).toBeGreaterThan(0);
      expect(res.body.bestSellers.length).toBeGreaterThan(0);
      expect(res.body.categories.length).toBe(5);
      expect(res.body.brands.length).toBe(11);
    });

    it('lists listed products in the shop and opens a product page', async () => {
      const shop = await request(app).get('/api/shop');
      expect(shop.status).toBe(200);
      expect(shop.body.products.length).toBeGreaterThan(0);

      const product = await request(app).get('/api/product/gazelle');
      expect(product.status).toBe(200);
      expect(product.body.product.productName).toBe('Gazelle');
    });

    it('lets the seeded shopper and admin log in', async () => {
      const shopper = await request(app)
        .post('/api/login')
        .send({ email: SEED_EMAILS.shopper, password: SEED_PASSWORDS.shopper });
      expect(shopper.status).toBe(200);

      const admin = await request(app)
        .post('/api/admin/login')
        .send({ email: SEED_EMAILS.admin, password: SEED_PASSWORDS.admin });
      expect(admin.status).toBe(200);
    });
  });
});
