import type { Document, Types } from 'mongoose';

export interface IReview extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  product: Types.ObjectId;
  rating: number;
  title: string;
  comment: string;
  images: string[];
  isVerifiedPurchase: boolean;
  helpfulVotes: number;
  reportedBy: Types.ObjectId[];
  isHidden: boolean;
  createdAt: Date;
  updatedAt: Date;
}
