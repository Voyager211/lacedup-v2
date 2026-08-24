import type { Document, Types } from 'mongoose';

export type CouponDiscountType = 'percentage' | 'fixed';

export interface ICouponUsage {
  user: Types.ObjectId;
  usedAt: Date;
  orderId?: Types.ObjectId;
}

export interface ICoupon extends Document {
  _id: Types.ObjectId;
  code: string;
  name: string;
  description?: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minimumOrderValue: number;
  /** Only meaningful for percentage coupons; null means uncapped. */
  maximumDiscountAmount: number | null;
  isReferralCoupon: boolean;
  assignedTo: Types.ObjectId | null;
  /** null means no global cap. */
  usageLimit: number | null;
  usedCount: number;
  /** Per-user cap. */
  userLimit: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  createdBy: Types.ObjectId;
  usedBy: ICouponUsage[];
  createdAt: Date;
  updatedAt: Date;
}
