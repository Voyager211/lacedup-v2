import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import PendingSignup from './pending-signup.model';
import type { IPendingSignup } from './pending-signup.model';
import User from '../users/user.model';
import type { IUser } from '../users/user.types';

/**
 * The signup held between requesting an OTP and verifying it.
 *
 * Replaces `req.session.pendingUser`. Keyed by email, which is what the client
 * sends back with the code, so the flow no longer depends on the session
 * surviving - previously a dropped session told the shopper their correct code
 * was wrong, and the only way out was to start again.
 */

/** Matches the User model's cost factor, so the hash transfers unchanged. */
const BCRYPT_ROUNDS = 12;

const OTP_TTL_MS = 60 * 1000;

export const hashOtp = (otp: string): string =>
  crypto.createHash('sha256').update(otp).digest('hex');

export const generateOtp = (): string =>
  Math.floor(100000 + Math.random() * 900000).toString();

export interface StartSignupInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  referralCode?: string | null;
  referrerId?: unknown;
}

/**
 * Records a signup attempt and returns the OTP to send.
 *
 * Upserts on email, so asking for a second code replaces the first rather than
 * leaving a stale row that could never match.
 */
export const startSignup = async (
  input: StartSignupInput
): Promise<{ otp: string; expiresAt: Date }> => {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await PendingSignup.findOneAndUpdate(
    { email: input.email.toLowerCase() },
    {
      name: input.name,
      email: input.email.toLowerCase(),
      phone: input.phone,
      // Hashed here rather than at the end of the flow: the session used to
      // hold the plaintext in the session store until it expired.
      passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      otpHash: hashOtp(otp),
      otpExpiresAt: expiresAt,
      referralCode: input.referralCode ?? null,
      referrerId: (input.referrerId as never) ?? null,
      createdAt: new Date()
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { otp, expiresAt };
};

export const findSignup = (email: string): Promise<IPendingSignup | null> =>
  PendingSignup.findOne({ email: email.toLowerCase() });

export const discardSignup = async (email: string): Promise<void> => {
  await PendingSignup.deleteOne({ email: email.toLowerCase() });
};

/** Issues a fresh code against an existing attempt. Null if there is none. */
export const refreshOtp = async (email: string): Promise<{ otp: string; name: string } | null> => {
  const pending = await findSignup(email);
  if (!pending) return null;

  const otp = generateOtp();
  pending.otpHash = hashOtp(otp);
  pending.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  await pending.save();

  return { otp, name: pending.name };
};

export type OtpCheck = 'ok' | 'expired' | 'incorrect';

export const checkOtp = (pending: IPendingSignup, otp: string): OtpCheck => {
  if (pending.otpExpiresAt.getTime() < Date.now()) return 'expired';
  if (pending.otpHash !== hashOtp(otp)) return 'incorrect';
  return 'ok';
};

/**
 * Turns a verified signup into a real user.
 *
 * The password arrives already bcrypt-hashed, and the User model hashes on
 * save whenever the field is modified - so it is un-marked before saving to
 * stop the hash being hashed a second time, which would leave an account whose
 * password could never match. `pending-signup.test.ts` signs in with the
 * original password to prove this stays true.
 */
export const createUserFrom = async (pending: IPendingSignup): Promise<IUser> => {
  // No `isVerified` flag: the User model has no such field, and does not need
  // one - a row only reaches this collection after the OTP has been checked,
  // so existence is verification. (Several test fixtures pass isVerified: true;
  // Mongoose silently drops it.)
  const user = new User({
    name: pending.name,
    email: pending.email,
    phone: pending.phone,
    password: pending.passwordHash
  });

  user.unmarkModified('password');
  await user.save();

  return user;
};
