const mongoose = require('mongoose');
const db = require('../../../common/testing/db');
const Coupon = require('../coupon.model');
const { validateCoupon, calculateDiscount } = require('../coupon.validation');

const daysFromNow = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

const makeCoupon = (overrides = {}) =>
  Coupon.create({
    code: 'SAVE10',
    name: 'Ten off',
    discountType: 'percentage',
    discountValue: 10,
    validFrom: daysFromNow(-1),
    validTo: daysFromNow(1),
    createdBy: new mongoose.Types.ObjectId(),
    ...overrides
  });

describe('calculateDiscount', () => {
  it('applies a percentage discount', () => {
    expect(calculateDiscount({ discountType: 'percentage', discountValue: 10 }, 2000)).toBe(200);
  });

  it('caps a percentage discount at maximumDiscountAmount', () => {
    const coupon = { discountType: 'percentage', discountValue: 50, maximumDiscountAmount: 300 };
    expect(calculateDiscount(coupon, 2000)).toBe(300);
  });

  it('applies a fixed discount', () => {
    expect(calculateDiscount({ discountType: 'fixed', discountValue: 250 }, 2000)).toBe(250);
  });

  // Without this clamp a large fixed-value coupon on a small basket would
  // produce a negative order total.
  it('never discounts more than the order total', () => {
    expect(calculateDiscount({ discountType: 'fixed', discountValue: 5000 }, 800)).toBe(800);
  });

  it('rounds to two decimal places', () => {
    expect(calculateDiscount({ discountType: 'percentage', discountValue: 33 }, 100.5)).toBe(33.17);
  });

  it('returns 0 for an unrecognised discount type', () => {
    expect(calculateDiscount({ discountType: 'mystery', discountValue: 10 }, 1000)).toBe(0);
  });
});

describe('validateCoupon', () => {
  const userId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Coupon.deleteMany({});
  });

  it('accepts a valid, active, in-date coupon', async () => {
    await makeCoupon();
    const result = await validateCoupon('SAVE10', userId, 1000);

    expect(result.valid).toBe(true);
    expect(result.coupon.code).toBe('SAVE10');
  });

  it('matches the code case-insensitively', async () => {
    await makeCoupon();
    expect((await validateCoupon('save10', userId, 1000)).valid).toBe(true);
  });

  it('rejects an unknown code', async () => {
    const result = await validateCoupon('NOPE', userId, 1000);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/invalid/i);
  });

  it('rejects an inactive coupon', async () => {
    await makeCoupon({ isActive: false });
    expect((await validateCoupon('SAVE10', userId, 1000)).valid).toBe(false);
  });

  it('rejects an expired coupon', async () => {
    await makeCoupon({ validFrom: daysFromNow(-10), validTo: daysFromNow(-5) });
    const result = await validateCoupon('SAVE10', userId, 1000);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/expired|not yet active/i);
  });

  it('rejects a coupon that is not yet active', async () => {
    await makeCoupon({ validFrom: daysFromNow(5), validTo: daysFromNow(10) });
    expect((await validateCoupon('SAVE10', userId, 1000)).valid).toBe(false);
  });

  // validTo is stretched to 23:59:59, so a coupon must still work on its final day.
  it('accepts a coupon on its last valid day', async () => {
    await makeCoupon({ validFrom: daysFromNow(-5), validTo: new Date() });
    expect((await validateCoupon('SAVE10', userId, 1000)).valid).toBe(true);
  });

  it('rejects an order below the minimum order value', async () => {
    await makeCoupon({ minimumOrderValue: 1500 });
    const result = await validateCoupon('SAVE10', userId, 1000);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/minimum order value/i);
  });

  it('accepts an order exactly at the minimum order value', async () => {
    await makeCoupon({ minimumOrderValue: 1000 });
    expect((await validateCoupon('SAVE10', userId, 1000)).valid).toBe(true);
  });

  it('rejects once the global usage limit is reached', async () => {
    await makeCoupon({ usageLimit: 5, usedCount: 5 });
    const result = await validateCoupon('SAVE10', userId, 1000);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/usage limit/i);
  });

  it('rejects once this user has hit their per-user limit', async () => {
    await makeCoupon({
      userLimit: 1,
      usedBy: [{ user: userId, usedAt: new Date() }]
    });
    const result = await validateCoupon('SAVE10', userId, 1000);

    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/already used/i);
  });

  // Per-user limits must be scoped per user, not shared across everyone.
  it('still accepts a different user when someone else has used the coupon', async () => {
    await makeCoupon({
      userLimit: 1,
      usedBy: [{ user: new mongoose.Types.ObjectId(), usedAt: new Date() }]
    });
    expect((await validateCoupon('SAVE10', userId, 1000)).valid).toBe(true);
  });
});
