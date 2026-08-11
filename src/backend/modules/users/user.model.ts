import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import type { IUser } from './user.types';

const userSchema = new mongoose.Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String },
    password: { type: String, required: true },
    profilePhoto: { type: String },

    referralCode: {
      type: String,
      unique: true,
      sparse: true // Allows null values while maintaining uniqueness
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    referralRewardClaimed: {
      type: Boolean,
      default: false
    },
    referralCount: {
      type: Number,
      default: 0
    },
    hasUsedReferralCode: {
      type: Boolean,
      default: false
    },

    // Auth
    role: { type: String, default: 'user', enum: ['user', 'admin'] },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date },

    // OTP
    otpHash: { type: String },
    otpExpiresAt: { type: Date },

    // SSO
    googleId: { type: String },
    facebookId: { type: String },

    // Password reset tracking
    passwordResetAt: { type: Date }
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = function (
  this: IUser,
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export = mongoose.model<IUser>('User', userSchema);
