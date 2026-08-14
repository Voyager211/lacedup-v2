import mongoose from 'mongoose';
import type { ICart } from './cart.types';

const { Schema } = mongoose;

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    items: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        variantId: {
          type: Schema.Types.ObjectId, // Reference to specific variant
          required: true
        },
        sku: {
          type: String, // Store the variant SKU for easy identification
          required: true
        },
        size: {
          type: String, // Store size for display purposes
          required: true
        },
        quantity: {
          type: Number,
          default: 1
        },
        price: {
          type: Number,
          required: true
        },
        totalPrice: {
          type: Number,
          required: true
        },
        status: {
          type: String,
          default: 'active'
        },
        cancellationReason: {
          type: String,
          default: 'none'
        }
      }
    ],

    /**
     * The coupon applied to this cart.
     *
     * Moved here from `req.session.appliedCoupon` in Phase 5. Storing it on the
     * cart is not just a place to put it: a coupon applies to a basket, so it
     * now survives a lost session and follows the shopper between devices,
     * which is what a shopper would expect of something they can see in their
     * cart. It is cleared when the cart changes materially or the order is
     * placed - see modules/coupons/applied-coupon.service.
     */
    appliedCoupon: {
      type: {
        couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true },
        code: { type: String, required: true },
        name: { type: String },
        discountType: { type: String },
        discountValue: { type: Number },
        discountAmount: { type: Number, required: true },
        appliedAt: { type: Date, default: Date.now },
        originalCartTotals: { type: Schema.Types.Mixed }
      },
      default: null
    }
  },
  { timestamps: true }
);

export = mongoose.model<ICart>('Cart', cartSchema);
