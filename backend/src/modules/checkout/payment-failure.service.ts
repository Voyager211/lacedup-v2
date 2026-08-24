import type { Types } from 'mongoose';
import Order from '../orders/order.model';
import PendingOrder from './pending-order.model';
import { PAYMENT_STATUS } from '../../common/constants/order.constants';

/**
 * The failed payment behind the failure and retry pages.
 *
 * This replaces `req.session.paymentFailure`, and unlike the other Phase 5
 * migrations nothing new had to be stored: the session was only ever a cache
 * over the failed Order, and the read path already knew how to rebuild the
 * record from it when the session was empty. So the cache is gone and the
 * rebuild is now the only path - which also means the retry flow survives a
 * dropped session, where before it silently sent the shopper back to the cart.
 *
 * The rebuild had a bug that made half of it unreachable: it branched on
 * `String().match(...)` - `String()` with no argument, which is the empty
 * string and never matches an ObjectId - so the lookup always fell through to
 * searching by order number. A failure page opened with a Mongo id found
 * nothing. Fixed here by matching on the value actually passed in.
 */

type UserId = Types.ObjectId | string;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export interface PaymentFailure {
  transactionId?: string;
  orderId: Types.ObjectId | string;
  orderNumber?: string;
  reason: string;
  failedAt?: Date;
  /**
   * The attempted order: items, address and totals.
   *
   * Deliberately loose, exactly as the session copy was - it is read back by
   * the retry flow and the failure page and nothing else, and pinning it here
   * would mean restating the Order schema in a second place.
   */
  orderData: any;
}

/** Shapes a failed order into the record the failure and retry pages expect. */
const toFailure = (order: any, transactionId?: unknown): PaymentFailure => ({
  transactionId: String(transactionId ?? order.razorpayOrderId ?? ''),
  orderId: order._id,
  orderNumber: order.orderId,
  reason: 'Payment failed. Please try again.',
  failedAt: order.updatedAt,
  orderData: {
    items: order.items,
    deliveryAddressId: order.deliveryAddress?.addressId,
    addressIndex: order.deliveryAddress?.addressIndex || 0,
    subtotal: order.subtotal,
    totalDiscount: order.totalDiscount,
    shipping: order.shipping,
    total: order.totalAmount,
    totalItemCount: order.totalItemCount,
    couponDiscount: order.couponDiscount || 0,
    appliedCouponId: order.couponApplied
  }
});

/**
 * Finds the failed payment behind a transaction id.
 *
 * The id in the URL is either the order's Mongo id or its order number - both
 * have been used - so both are tried, scoped to the signed-in user so one
 * shopper cannot read another's failed order by guessing an id.
 */
export const failureByTransaction = async (
  userId: UserId,
  transactionId: string | number | string[] | undefined
): Promise<PaymentFailure | null> => {
  const scope = { user: userId as never, paymentStatus: PAYMENT_STATUS.FAILED };

  const order = OBJECT_ID.test(String(transactionId))
    ? await Order.findOne({ ...scope, _id: transactionId }).lean()
    : await Order.findOne({ ...scope, orderId: transactionId }).lean();

  return order ? toFailure(order, transactionId) : null;
};

/**
 * The same, for the retry flow, which only knows the Razorpay order id.
 *
 * The retry snapshot records the order it is retrying, so the failed order is
 * reached through it rather than through the session that used to hold it.
 */
export const failureByRazorpayOrder = async (
  userId: UserId,
  razorpayOrderId: string
): Promise<PaymentFailure | null> => {
  const pending = await PendingOrder.findOne({ razorpayOrderId }).lean();
  if (!pending?.retryOrderId) return null;

  const order = await Order.findOne({
    user: userId as never,
    orderId: pending.retryOrderId
  }).lean();

  return order ? toFailure(order, razorpayOrderId) : null;
};
