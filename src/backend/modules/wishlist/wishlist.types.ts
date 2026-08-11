import type { Document, Types } from 'mongoose';

export interface IWishlistEntry {
  productId: Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  products: IWishlistEntry[];
  createdAt: Date;
  updatedAt: Date;
}
