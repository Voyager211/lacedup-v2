import type { Document, Types } from 'mongoose';

export type UserRole = 'user' | 'admin';

export interface IUser extends Document {
  _id: Types.ObjectId;

  name: string;
  email: string;
  phone?: string;
  password: string;
  profilePhoto?: string;

  referralCode?: string;
  referredBy: Types.ObjectId | null;
  referralRewardClaimed: boolean;
  referralCount: number;
  hasUsedReferralCode: boolean;

  // Auth
  role: UserRole;
  isBlocked: boolean;
  blockedAt?: Date;

  // OTP
  otpHash?: string;
  otpExpiresAt?: Date;

  // SSO
  googleId?: string;
  facebookId?: string;

  // Password reset tracking
  passwordResetAt?: Date;

  createdAt: Date;
  updatedAt: Date;

  /** Compares a plaintext candidate against the stored bcrypt hash. */
  comparePassword(candidatePassword: string): Promise<boolean>;
}
