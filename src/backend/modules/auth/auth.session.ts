import type { Response } from 'express';
import type { Types } from 'mongoose';
import RefreshToken from './refresh-token.model';
import {
  clearAuthCookies,
  hashToken,
  newTokenId,
  refreshExpiryDate,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  type TokenAudience
} from './jwt.service';

/**
 * Issuing, rotating and revoking a login.
 *
 * Kept separate from jwt.service so that file stays pure token mechanics with
 * no database access, which is what makes it cheap to unit test.
 */

interface IssuableUser {
  _id: Types.ObjectId | string;
  role?: string;
}

/** Issues a fresh token pair and sets both cookies. */
export const issueSession = async (
  res: Response,
  user: IssuableUser,
  audience: TokenAudience
): Promise<{ accessToken: string; refreshToken: string }> => {
  const userId = String(user._id);
  const tokenId = newTokenId();

  const accessToken = signAccessToken(userId, user.role ?? 'user', audience);
  const refreshToken = signRefreshToken(userId, audience, tokenId);

  await RefreshToken.create({
    tokenId,
    userId: user._id,
    tokenHash: hashToken(refreshToken),
    audience,
    expiresAt: refreshExpiryDate()
  });

  setAuthCookies(res, audience, accessToken, refreshToken);

  return { accessToken, refreshToken };
};

/**
 * Exchanges a refresh token for a new pair, rotating it.
 *
 * The old row is revoked as part of the exchange, so a refresh token is
 * single-use: replaying a stolen one after the legitimate client has refreshed
 * finds it already revoked and fails.
 */
export const rotateSession = async (
  res: Response,
  presentedToken: string,
  audience: TokenAudience
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> => {
  const payload = verifyRefreshToken(presentedToken, audience);
  if (!payload) {
    return { ok: false, reason: 'Invalid or expired refresh token' };
  }

  const stored = await RefreshToken.findOne({ tokenId: payload.jti });
  if (!stored) {
    return { ok: false, reason: 'Refresh token not recognised' };
  }
  if (stored.revokedAt) {
    return { ok: false, reason: 'Refresh token already used' };
  }
  if (stored.tokenHash !== hashToken(presentedToken)) {
    return { ok: false, reason: 'Refresh token mismatch' };
  }
  if (stored.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: 'Refresh token expired' };
  }

  stored.revokedAt = new Date();
  await stored.save();

  await issueSession(res, { _id: stored.userId, role: payload.aud === 'admin' ? 'admin' : 'user' }, audience);

  return { ok: true, userId: String(stored.userId) };
};

/** Revokes the presented refresh token and clears both cookies. */
export const endSession = async (
  res: Response,
  presentedToken: string | undefined,
  audience: TokenAudience
): Promise<void> => {
  if (presentedToken) {
    const payload = verifyRefreshToken(presentedToken, audience);
    if (payload) {
      await RefreshToken.updateOne(
        { tokenId: payload.jti, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
  }

  clearAuthCookies(res, audience);
};

/** Revokes every outstanding refresh token for a user, e.g. when they are blocked. */
export const revokeAllSessions = async (userId: Types.ObjectId | string): Promise<void> => {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};
