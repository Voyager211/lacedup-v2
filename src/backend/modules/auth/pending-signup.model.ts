import mongoose from 'mongoose';
import type { Document, Types } from 'mongoose';

const { Schema } = mongoose;

export interface IPendingSignup extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  /** bcrypt hash. The plaintext never reaches this collection. */
  passwordHash: string;
  /** sha256 of the six-digit code. */
  otpHash: string;
  otpExpiresAt: Date;
  referralCode?: string | null;
  referrerId?: Types.ObjectId | null;
  createdAt: Date;
}

/**
 * A signup held between requesting the OTP and verifying it.
 *
 * This replaces `req.session.pendingUser`, and moves the flow off the session
 * for the same reason the Razorpay snapshot moved: the record is looked up by
 * the email the client supplies, so a lost session no longer strands someone
 * who has already been sent a code. Previously the OTP page would tell them
 * the code was wrong, with no way to recover but to sign up again.
 *
 * Two things are stored differently to how the session stored them:
 *
 *  - The password is hashed here. The session put it in plaintext into the
 *    session store, which is a MongoDB collection - so an unverified signup
 *    left a readable password sitting in the database until the session
 *    expired. The User model hashes on save, so this is hashed on the way in
 *    and passed through on the way out (see markVerified in the service).
 *  - `createdAt` carries a TTL, so abandoned signups delete themselves instead
 *    of accumulating.
 */
const pendingSignupSchema = new Schema<IPendingSignup>({
  name: { type: String, required: true },

  // Unique so that requesting a second code for the same address replaces the
  // first rather than leaving two rows, only one of which would ever match.
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },

  phone: { type: String },
  passwordHash: { type: String, required: true },
  otpHash: { type: String, required: true },
  otpExpiresAt: { type: Date, required: true },
  referralCode: { type: String, default: null },
  referrerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  // Well beyond the one-minute OTP: the row has to outlive the code so that
  // "expired, please sign up again" can be told apart from "no such signup".
  createdAt: { type: Date, default: Date.now, expires: 60 * 30 }
});

export = mongoose.model<IPendingSignup>('PendingSignup', pendingSignupSchema);
