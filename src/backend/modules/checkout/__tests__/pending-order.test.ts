import mongoose from 'mongoose';
import * as db from '../../../common/testing/db';
import PendingOrder from '../pending-order.model';

/**
 * The pending-payment snapshot.
 *
 * This replaced `req.session.pendingRazorpayOrder`. The point of the change is
 * that verification finds the snapshot by the Razorpay order id - which
 * Razorpay itself supplies in the callback - rather than by session, so a lost
 * session can no longer leave a customer charged with no order.
 *
 * These tests pin the properties that make that work: the key is unique and
 * indexed, the frozen prices survive the round trip, and the record expires on
 * its own so abandoned payments do not accumulate.
 */
describe('PendingOrder', () => {
  const base = () => ({
    razorpayOrderId: `order_${new mongoose.Types.ObjectId().toString()}`,
    tempOrderId: 'TEMP-ORD-1',
    userId: new mongoose.Types.ObjectId(),
    deliveryAddressId: new mongoose.Types.ObjectId(),
    addressIndex: 0,
    cart: [
      {
        productId: new mongoose.Types.ObjectId(),
        variantId: new mongoose.Types.ObjectId(),
        sku: 'SKU-1',
        size: 'UK 8',
        quantity: 2,
        price: 1499.5,
        totalPrice: 2999
      }
    ],
    totals: {
      subtotal: 3000,
      totalDiscount: 0,
      amountAfterDiscount: 3000,
      shipping: 0,
      totalItemCount: 2
    },
    couponDiscount: 0,
    amount: 2999
  });

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await PendingOrder.deleteMany({});
  });

  it('is found by the Razorpay order id alone - no session involved', async () => {
    const created = await PendingOrder.create(base());

    const found = await PendingOrder.findOne({ razorpayOrderId: created.razorpayOrderId }).lean();

    expect(found).not.toBeNull();
    expect(String(found?.userId)).toBe(String(created.userId));
  });

  it('refuses two snapshots for the same Razorpay order', async () => {
    // A duplicate would mean two orders could be created for one payment.
    const payload = base();
    await PendingOrder.create(payload);

    await expect(PendingOrder.create(payload)).rejects.toThrow();
  });

  it('preserves the quoted prices exactly', async () => {
    // The whole reason the snapshot exists: prices are recomputed per request,
    // so the amount charged must be frozen at quote time and read back
    // unchanged - fractional paise included.
    const created = await PendingOrder.create(base());

    const found = await PendingOrder.findOne({ razorpayOrderId: created.razorpayOrderId }).lean();

    expect(found?.cart[0]?.price).toBe(1499.5);
    expect(found?.cart[0]?.totalPrice).toBe(2999);
    expect(found?.amount).toBe(2999);
    expect(found?.totals.subtotal).toBe(3000);
  });

  it('keeps the line items intact rather than flattening them', async () => {
    const created = await PendingOrder.create(base());
    const found = await PendingOrder.findOne({ razorpayOrderId: created.razorpayOrderId }).lean();

    expect(found?.cart).toHaveLength(1);
    expect(found?.cart[0]).toMatchObject({ sku: 'SKU-1', size: 'UK 8', quantity: 2 });
  });

  it('marks a retry so verification pays an existing order rather than creating one', async () => {
    const created = await PendingOrder.create({ ...base(), retryOrderId: 'ORD000123' });

    const found = await PendingOrder.findOne({ razorpayOrderId: created.razorpayOrderId }).lean();

    expect(found?.retryOrderId).toBe('ORD000123');
  });

  it('leaves retryOrderId null on a first attempt', async () => {
    const created = await PendingOrder.create(base());
    const found = await PendingOrder.findOne({ razorpayOrderId: created.razorpayOrderId }).lean();

    expect(found?.retryOrderId).toBeNull();
  });

  it('expires on its own, so abandoned payments do not accumulate', async () => {
    // Asserting the index exists rather than waiting for MongoDB to reap it -
    // the reaper runs on its own schedule and a timing test would be flaky.
    const indexes = await PendingOrder.collection.indexes();
    const ttl = indexes.find((index) => index.expireAfterSeconds !== undefined);

    expect(ttl).toBeDefined();
    expect(ttl?.key).toHaveProperty('createdAt');
    expect(ttl?.expireAfterSeconds).toBe(60 * 30);
  });

  it('indexes the Razorpay id uniquely, so the lookup stays cheap', async () => {
    const indexes = await PendingOrder.collection.indexes();
    const unique = indexes.find((index) => index.key?.razorpayOrderId !== undefined);

    expect(unique).toBeDefined();
    expect(unique?.unique).toBe(true);
  });

  it('is removed once the payment is settled', async () => {
    const created = await PendingOrder.create(base());

    await PendingOrder.deleteOne({ razorpayOrderId: created.razorpayOrderId });

    expect(await PendingOrder.findOne({ razorpayOrderId: created.razorpayOrderId })).toBeNull();
  });
});
