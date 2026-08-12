import type { IUser } from './user.types';

/**
 * The user shape safe to send to a client.
 *
 * Written as an allowlist rather than by deleting fields from the document:
 * a new sensitive column added to the schema later is excluded by default
 * instead of leaking until someone remembers to strip it. `password`,
 * `otpHash`, `otpExpiresAt` and the SSO ids never cross this boundary.
 */
export interface PublicUser {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profilePhoto?: string;
  role: 'user' | 'admin';
  isBlocked: boolean;
  referralCode?: string;
  referralCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export const publicUser = (user: IUser): PublicUser => ({
  _id: String(user._id),
  name: user.name,
  email: user.email,
  phone: user.phone,
  profilePhoto: user.profilePhoto,
  role: user.role,
  isBlocked: user.isBlocked,
  referralCode: user.referralCode,
  referralCount: user.referralCount,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
