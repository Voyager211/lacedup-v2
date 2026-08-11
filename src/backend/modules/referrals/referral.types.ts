import type { Document, Types } from 'mongoose';

export type ReferralStatus = 'pending' | 'completed' | 'cancelled';

export interface IReferral extends Document {
  _id: Types.ObjectId;
  referrer: Types.ObjectId;
  referee: Types.ObjectId;
  referralCode: string;
  rewardAmount: number;
  status: ReferralStatus;
  rewardGivenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
