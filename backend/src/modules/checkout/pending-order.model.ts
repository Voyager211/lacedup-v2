import mongoose from 'mongoose';

/**
 * A payment in flight.
 *
 * Between creating a Razorpay order and verifying its signature, the server
 * needs to remember what was being paid for: the line items at the prices
 * quoted, the coupon applied, the totals, and the address chosen. Without that
 * snapshot the order created on verification could differ from the amount the
 * customer was actually charged - prices are recomputed per request, and an
 * offer or coupon can change in between.
 *
 * This used to live in `req.session.pendingRazorpayOrder`, which had a real
 * failure mode: if the session expired or was lost between the two calls, the
 * payment succeeded at Razorpay and verification answered "No pending order
 * found" - the customer charged, with no order to show for it.
 *
 * Keying on `razorpayOrderId` removes the dependency entirely. Razorpay hands
 * that id back in the verification callback, so the snapshot is found without
 * any session, cookie or client state being involved.
 */
/**
 * A frozen cart line.
 *
 * Typed rather than left as Mixed so the verification handler, which rebuilds
 * order items from this, keeps its type checking. The values are copies taken
 * at quote time - `price` is what the customer is being charged, not whatever
 * the product costs now.
 */
export interface PendingCartItem {
  productId: mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId };
  variantId?: mongoose.Types.ObjectId;
  sku?: string;
  size?: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface PendingTotals {
  subtotal: number;
  totalDiscount: number;
  amountAfterDiscount: number;
  shipping: number;
  totalItemCount: number;
  total?: number;
}

export interface IPendingOrder extends mongoose.Document {
  razorpayOrderId: string;
  tempOrderId: string;
  userId: mongoose.Types.ObjectId;
  deliveryAddressId: mongoose.Types.ObjectId;
  addressIndex: number;
  /** The cart as it stood when the payment was created, at the quoted prices. */
  cart: PendingCartItem[];
  totals: PendingTotals;
  couponDiscount: number;
  appliedCouponId?: mongoose.Types.ObjectId | null;
  amount: number;
  /** Set for the retry flow, which pays for an order row that already exists. */
  retryOrderId?: string | null;
  createdAt: Date;
}

const pendingOrderSchema = new mongoose.Schema<IPendingOrder>({
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  tempOrderId: { type: String, required: true },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  deliveryAddressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  addressIndex: { type: Number, default: 0 },
  /*
   * Declared explicitly rather than as Mixed. The line items are a frozen copy
   * and must survive the round trip exactly - a Mixed array would let a typo
   * in the verification handler read a field that was never written, and
   * silently produce an order at the wrong price.
   */
  cart: {
    type: [
      new mongoose.Schema<PendingCartItem>(
        {
          productId: { type: mongoose.Schema.Types.Mixed, required: true },
          variantId: { type: mongoose.Schema.Types.ObjectId },
          sku: { type: String },
          size: { type: String },
          quantity: { type: Number, required: true },
          price: { type: Number, required: true },
          totalPrice: { type: Number, required: true }
        },
        { _id: false }
      )
    ],
    default: []
  },

  totals: {
    type: new mongoose.Schema<PendingTotals>(
      {
        subtotal: { type: Number, default: 0 },
        totalDiscount: { type: Number, default: 0 },
        amountAfterDiscount: { type: Number, default: 0 },
        shipping: { type: Number, default: 0 },
        totalItemCount: { type: Number, default: 0 },
        total: { type: Number }
      },
      { _id: false }
    ),
    required: true
  },
  couponDiscount: { type: Number, default: 0 },
  appliedCouponId: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', default: null },
  amount: { type: Number, required: true },
  retryOrderId: { type: String, default: null },

  /**
   * TTL index. A payment either completes within minutes or is abandoned, and
   * an abandoned snapshot has no value once its Razorpay order is stale.
   * Thirty minutes is comfortably longer than any real checkout and short
   * enough that the collection stays small.
   */
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 30
  }
});

const PendingOrder = mongoose.model<IPendingOrder>('PendingOrder', pendingOrderSchema);

export default PendingOrder;
