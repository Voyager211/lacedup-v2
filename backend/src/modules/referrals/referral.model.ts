import mongoose from 'mongoose';
import type { IReferral } from './referral.types';

const referralSchema = new mongoose.Schema<IReferral>(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    referee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    referralCode: {
      type: String,
      required: true
    },
    rewardAmount: {
      type: Number,
      default: 300
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'cancelled'],
      default: 'pending'
    },
    rewardGivenAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

referralSchema.index({ referrer: 1 });
referralSchema.index({ referee: 1 });

export = mongoose.model<IReferral>('Referral', referralSchema);
