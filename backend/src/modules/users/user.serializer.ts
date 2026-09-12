import type { IUser } from './user.types';

/**
 * A profile photo the browser can actually load.
 *
 * This field used to hold a bare filename - `profile_<id>_<ts>.jpg` - while
 * every other image in the app stored a URL. The React app renders it straight
 * into a src, so the browser resolved it against whatever route the visitor was
 * on and 404'd: profile photos uploaded fine and then never appeared.
 *
 * Uploads now store a URL like everything else. This is what keeps the rows
 * written before that from being broken, and it is a pure function of the
 * stored value, so it costs nothing once they are all migrated.
 */
export const profilePhotoUrl = (stored: string): string =>
  /^(https?:\/\/|\/)/.test(stored) ? stored : `/uploads/profiles/${stored}`;

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
  profilePhoto: user.profilePhoto ? profilePhotoUrl(user.profilePhoto) : undefined,
  role: user.role,
  isBlocked: user.isBlocked,
  referralCode: user.referralCode,
  referralCount: user.referralCount,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});
