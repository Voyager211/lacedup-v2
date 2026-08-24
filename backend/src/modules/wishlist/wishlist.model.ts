import mongoose from 'mongoose';
import type { IWishlist } from './wishlist.types';

const wishlistSchema = new mongoose.Schema<IWishlist>(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        addedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

// Ensure a user can only have one wishlist
wishlistSchema.index({ userId: 1 }, { unique: true });

// Ensure a product can only be added once to a user's wishlist
wishlistSchema.index({ userId: 1, 'products.productId': 1 }, { unique: true });

export = mongoose.model<IWishlist>('Wishlist', wishlistSchema);
