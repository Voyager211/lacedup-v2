import mongoose from 'mongoose';
import * as db from '../../../common/testing/db';
import Cart from '../../cart/cart.model';
import {
  clearAppliedCoupon,
  getAppliedCoupon,
  getAppliedDiscount,
  setAppliedCoupon
} from '../applied-coupon.service';

/**
 * The applied coupon, after moving off the session.
 *
 * It used to live in `req.session.appliedCoupon`: written once, read about
 * twenty times, and deleted twenty-nine times across checkout and cart
 * mutation. It now lives on the cart, which is where it belongs - a coupon
 * applies to a basket.
 *
 * The behavioural gain is in the last two tests: an applied coupon now
 * survives a lost session and is visible from any device, because it is stored
 * against the cart rather than against a browser cookie.
 */

const userId = () => new mongoose.Types.ObjectId();

const coupon = (overrides = {}) => ({
  couponId: new mongoose.Types.ObjectId(),
  code: 'SAVE20',
  name: '20% off',
  discountType: 'percentage',
  discountValue: 20,
  discountAmount: 400,
  originalCartTotals: { subtotal: 2000, total: 2000 },
  ...overrides
});

describe('applied coupon', () => {
  let user: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await db.disconnect();
  });

  beforeEach(async () => {
    await Cart.deleteMany({});
    user = userId();
    await Cart.create({ userId: user, items: [] });
  });

  it('reads back nothing when no coupon is applied', async () => {
    expect(await getAppliedCoupon(user)).toBeNull();
    expect(await getAppliedDiscount(user)).toBe(0);
  });

  it('stores and reads back a coupon', async () => {
    const applied = coupon();

    await setAppliedCoupon(user, applied);

    const found = await getAppliedCoupon(user);
    expect(found?.code).toBe('SAVE20');
    expect(found?.discountAmount).toBe(400);
    expect(String(found?.couponId)).toBe(String(applied.couponId));
  });

  it('stamps appliedAt when the caller does not', async () => {
    await setAppliedCoupon(user, coupon());

    const found = await getAppliedCoupon(user);
    expect(found?.appliedAt).toBeInstanceOf(Date);
  });

  it('freezes the discount rather than recomputing it on read', async () => {
    // The shopper is shown a number when they apply the coupon; it must not
    // drift before they pay. Re-validation happens at checkout, deliberately
    // as a separate step.
    await setAppliedCoupon(user, coupon({ discountAmount: 137.5 }));

    expect(await getAppliedDiscount(user)).toBe(137.5);
  });

  it('keeps the totals the discount was calculated against', async () => {
    await setAppliedCoupon(user, coupon());

    const found = await getAppliedCoupon(user);
    expect(found?.originalCartTotals).toMatchObject({ subtotal: 2000 });
  });

  it('clears the coupon', async () => {
    await setAppliedCoupon(user, coupon());
    await clearAppliedCoupon(user);

    expect(await getAppliedCoupon(user)).toBeNull();
  });

  it('is safe to clear when nothing is applied', async () => {
    // Most call sites are "the cart changed, so invalidate any discount" and
    // should not have to check first - twenty-nine of them.
    await expect(clearAppliedCoupon(user)).resolves.not.toThrow();

    expect(await getAppliedCoupon(user)).toBeNull();
  });

  it('replaces an existing coupon rather than stacking', async () => {
    await setAppliedCoupon(user, coupon({ code: 'FIRST', discountAmount: 100 }));
    await setAppliedCoupon(user, coupon({ code: 'SECOND', discountAmount: 250 }));

    const found = await getAppliedCoupon(user);
    expect(found?.code).toBe('SECOND');
    expect(await getAppliedDiscount(user)).toBe(250);
  });

  it('keeps one shopper out of another shopper cart', async () => {
    const other = userId();
    await Cart.create({ userId: other, items: [] });

    await setAppliedCoupon(user, coupon({ code: 'MINE' }));

    expect(await getAppliedCoupon(other)).toBeNull();
  });

  it('survives losing the session, which is the point of the move', async () => {
    await setAppliedCoupon(user, coupon());

    // Nothing here carries a session or a cookie. The coupon is found from the
    // user id alone, so a dropped session no longer silently un-applies a
    // discount the shopper can still see in their cart.
    const found = await getAppliedCoupon(user);

    expect(found?.code).toBe('SAVE20');
  });

  it('does nothing when the shopper has no cart yet', async () => {
    const cartless = userId();

    await expect(setAppliedCoupon(cartless, coupon())).resolves.not.toThrow();
    expect(await getAppliedCoupon(cartless)).toBeNull();
  });
});
