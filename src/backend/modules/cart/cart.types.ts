import type { Document, Types } from 'mongoose';

export interface ICartItem {
  _id: Types.ObjectId;
  productId: Types.ObjectId;
  /** Points at a variant subdocument inside the product. */
  variantId: Types.ObjectId;
  sku: string;
  size: string;
  quantity: number;
  price: number;
  totalPrice: number;
  status: string;
  cancellationReason: string;
}

export interface ICart extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}
