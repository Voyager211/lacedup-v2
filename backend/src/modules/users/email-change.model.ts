import mongoose from 'mongoose';
import type { Document, Types } from 'mongoose';

const { Schema } = mongoose;

export interface IEmailChange extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  /** sha256 of the six-digit code. The code itself is never stored. */
  otpHash: string;
  otpExpiresAt: Date;
  /** The address the code was sent to - always the account's current one. */
  currentEmail: string;
  /**
   * The requested address.
   *
   * Set up front by the one-step flow, and only after the current address has
   * been confirmed by the two-step flow - so it is optional.
   */
  newEmail?: string | null;
  /** True once the current address has been confirmed, in the two-step flow. */
  verified: boolean;
  createdAt: Date;
}

/**
 * An email change in progress.
 *
 * This replaces `req.session.emailChangeOtp`, which two different flows wrote
 * with two different shapes - which is why its type declaration had almost
 * every field optional:
 *
 *  - one step: the new address is given up front, a code goes to the current
 *    address, and verifying it applies the change.
 *  - two step: a code goes to the current address to prove ownership, and only
 *    then is the new address accepted.
 *
 * Both are keyed by user, so one record with `newEmail` and `verified`
 * optional covers both without either having to know about the other.
 *
 * The code is hashed here. The session stored it in clear, which the signup
 * flow never did - the two had drifted apart.
 */
const emailChangeSchema = new Schema<IEmailChange>({
  // Unique so that restarting the flow replaces the attempt in progress
  // rather than leaving a stale row that could never match.
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  otpHash: { type: String, required: true },
  otpExpiresAt: { type: Date, required: true },
  currentEmail: { type: String, required: true },
  newEmail: { type: String, default: null },
  verified: { type: Boolean, default: false },

  // Comfortably longer than the code, so "expired, request another" stays
  // distinguishable from "no change in progress".
  createdAt: { type: Date, default: Date.now, expires: 60 * 30 }
});

// `export default`, not `export =` - see the note in pending-signup.model.ts.
// Mixing an export assignment with a named export produces a module that
// throws on import under tsx, which tsc and Vitest both accept.
const EmailChange = mongoose.model<IEmailChange>('EmailChange', emailChangeSchema);

export default EmailChange;
