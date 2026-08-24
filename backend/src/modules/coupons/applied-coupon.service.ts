import type { Types } from 'mongoose';
import Cart from '../cart/cart.model';
import type { IAppliedCoupon } from '../cart/cart.types';

/**
 * The coupon applied to a shopper's cart.
 *
 * This replaces `req.session.appliedCoupon`, which was written in one place,
 * read in about twenty, and deleted in twenty-nine - the deletes scattered
 * through checkout and cart mutation wherever someone remembered that changing
 * the basket should invalidate a discount calculated against it.
 *
 * Consolidating them here is the point of the module. The rule "if the cart
 * changes, the coupon is no longer valid" is now stated once, and the call
 * sites say what they mean (`clearAppliedCoupon`) rather than reaching into a
 * session object.
 *
 * Everything is keyed by user rather than by request, so an applied coupon
 * survives a lost session and follows the shopper across devices.
 */

type UserId = Types.ObjectId | string;

/** The applied coupon, or null. */
export const getAppliedCoupon = async (userId: UserId): Promise<IAppliedCoupon | null> => {
  const cart = await Cart.findOne({ userId }).select('appliedCoupon').lean();
  return (cart?.appliedCoupon as IAppliedCoupon | undefined) ?? null;
};

/**
 * Applies a coupon to the cart.
 *
 * `discountAmount` and `originalCartTotals` are the figures the caller
 * calculated; they are stored as given and re-validated at checkout rather
 * than recomputed here, so the shopper sees a stable number between applying
 * the coupon and paying.
 */
export const setAppliedCoupon = async (
  userId: UserId,
  coupon: Omit<IAppliedCoupon, 'appliedAt'> & { appliedAt?: Date }
): Promise<void> => {
  await Cart.updateOne(
    { userId },
    { $set: { appliedCoupon: { ...coupon, appliedAt: coupon.appliedAt ?? new Date() } } }
  );
};

/**
 * Removes the applied coupon.
 *
 * Safe to call when nothing is applied - most call sites are "the cart changed,
 * so invalidate any discount" and should not have to check first.
 */
export const clearAppliedCoupon = async (userId: UserId): Promise<void> => {
  await Cart.updateOne({ userId }, { $set: { appliedCoupon: null } });
};

/** The discount currently applied, or 0. Convenience for total calculations. */
export const getAppliedDiscount = async (userId: UserId): Promise<number> => {
  const coupon = await getAppliedCoupon(userId);
  return coupon?.discountAmount ?? 0;
};
