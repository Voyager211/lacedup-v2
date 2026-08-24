import crypto from 'crypto';
import type { Types } from 'mongoose';
import EmailChange from './email-change.model';
import type { IEmailChange } from './email-change.model';

/**
 * The email change in progress.
 *
 * Replaces `req.session.emailChangeOtp`. Keyed by user, so the flow no longer
 * depends on the session surviving, and the code is hashed rather than stored
 * in clear - which is what the signup flow had always done.
 */

type UserId = Types.ObjectId | string;

export const hashOtp = (otp: string): string =>
  crypto.createHash('sha256').update(otp).digest('hex');

export const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export interface StartInput {
  userId: UserId;
  currentEmail: string;
  /** Given up front by the one-step flow; omitted by the two-step flow. */
  newEmail?: string | null;
  /** Defaults to 60s. The two-step flow uses 45s, as it always has. */
  ttlMs?: number;
}

/** Begins (or restarts) an email change and returns the code to send. */
export const startEmailChange = async (input: StartInput): Promise<{ otp: string }> => {
  const otp = generateOtp();

  await EmailChange.findOneAndUpdate(
    { userId: input.userId },
    {
      userId: input.userId,
      otpHash: hashOtp(otp),
      otpExpiresAt: new Date(Date.now() + (input.ttlMs ?? 60 * 1000)),
      currentEmail: input.currentEmail,
      newEmail: input.newEmail ?? null,
      // Restarting the flow drops any prior confirmation, so a stale record
      // cannot be used to skip the ownership check.
      verified: false,
      createdAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { otp };
};

export const findEmailChange = (userId: UserId): Promise<IEmailChange | null> =>
  EmailChange.findOne({ userId });

export const discardEmailChange = async (userId: UserId): Promise<void> => {
  await EmailChange.deleteOne({ userId });
};

export type OtpCheck = 'ok' | 'expired' | 'incorrect';

export const checkOtp = (record: IEmailChange, otp: string): OtpCheck => {
  if (record.otpExpiresAt.getTime() < Date.now()) return 'expired';
  if (record.otpHash !== hashOtp(String(otp))) return 'incorrect';
  return 'ok';
};

/** Issues a fresh code against an attempt in progress. Null if there is none. */
export const refreshOtp = async (
  userId: UserId,
  ttlMs = 60 * 1000
): Promise<{ otp: string; currentEmail: string } | null> => {
  const record = await findEmailChange(userId);
  if (!record) return null;

  const otp = generateOtp();
  record.otpHash = hashOtp(otp);
  record.otpExpiresAt = new Date(Date.now() + ttlMs);
  await record.save();

  return { otp, currentEmail: record.currentEmail };
};

/** Marks the current address confirmed, for the two-step flow. */
export const markVerified = async (userId: UserId): Promise<void> => {
  await EmailChange.updateOne({ userId }, { $set: { verified: true } });
};
