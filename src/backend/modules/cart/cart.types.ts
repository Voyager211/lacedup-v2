import type { Document, Types } from 'mongoose';

export interface ICartItem {
  /** Assigned by Mongoose when the subdocument is saved. */
  _id?: Types.ObjectId;
  productId: Types.ObjectId;
  /** Points at a variant subdocument inside the product. */
  variantId: Types.ObjectId;
  sku: string;
  size: string;
  quantity: number;
  price: number;
  totalPrice: number;
  /** Schema defaults to 'active'. */
  status?: string;
  /** Schema defaults to 'none'. */
  cancellationReason?: string;
}

/**
 * A coupon held against the cart between applying it and placing the order.
 *
 * This is a snapshot, not a reference: the discount was calculated against the
 * cart as it stood, so `discountAmount` and `originalCartTotals` are frozen at
 * apply time and re-validated at checkout rather than recomputed on read.
 */
export interface IAppliedCoupon {
  couponId: Types.ObjectId;
  code: string;
  name?: string;
  discountType?: string;
  discountValue?: number;
  discountAmount: number;
  appliedAt: Date;
  /**
   * The totals the discount was calculated against.
   *
   * Deliberately loose - it is a snapshot for re-validation at checkout, and
   * pinning it to CartTotals here would make the cart module depend on the
   * coupon module's shape.
   */
  originalCartTotals?: unknown;
}

export interface ICart extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: ICartItem[];
  /** Null when no coupon is applied. See modules/coupons/applied-coupon.service. */
  appliedCoupon?: IAppliedCoupon | null;
  createdAt: Date;
  updatedAt: Date;
}
