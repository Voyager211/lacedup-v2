import mongoose from 'mongoose';
import type { ICoupon } from './coupon.types';

const couponSchema = new mongoose.Schema<ICoupon>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    minimumOrderValue: {
      type: Number,
      default: 0,
      min: 0
    },
    maximumDiscountAmount: {
      type: Number,
      default: null
    },
    isReferralCoupon: {
      type: Boolean,
      default: false
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    usageLimit: {
      type: Number,
      default: null
    },
    usedCount: {
      type: Number,
      default: 0
    },
    userLimit: {
      type: Number,
      default: 1
    },
    validFrom: {
      type: Date,
      required: true
    },
    validTo: {
      type: Date,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    usedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        usedAt: {
          type: Date,
          default: Date.now
        },
        orderId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Order'
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Index for efficient queries.
//
// NOTE: `code` is declared `unique: true` above, which already creates an
// index. The former explicit couponSchema.index({ code: 1 }) duplicated it and
// was the source of the "Duplicate schema index on {code:1}" warning logged on
// every boot.
couponSchema.index({ validFrom: 1, validTo: 1 });
couponSchema.index({ isActive: 1 });

export = mongoose.model<ICoupon>('Coupon', couponSchema);
