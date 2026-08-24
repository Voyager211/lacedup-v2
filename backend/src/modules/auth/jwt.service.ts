import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import type { Response } from 'express';

/**
 * JWT issuing and verification.
 *
 * Tokens are carried in httpOnly cookies rather than a response body, so the
 * browser attaches them automatically and no script can read them - which is
 * what keeps an XSS from walking off with a session. The React client is served
 * from the same origin, so no Authorization header plumbing is needed.
 *
 * Admin and shopper tokens use separate cookie names, preserving today's
 * behaviour where admin.sid and user.sid let one browser hold both sessions at
 * once. The audience claim is checked on verify, so a shopper token cannot be
 * replayed against an admin route even if the cookie is moved.
 */

export type TokenAudience = 'user' | 'admin';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  aud: TokenAudience;
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  aud: TokenAudience;
  typ: 'refresh';
  /** Identifies the stored refresh-token row, so it can be revoked. */
  jti: string;
}

/**
 * Access-token lifetimes mirror the session durations they replace: 60 minutes
 * for admin, 20 for shoppers.
 */
const ACCESS_TTL: Record<TokenAudience, string> = {
  admin: '60m',
  user: '20m'
};

/** Refresh tokens outlive the access token so a return visit does not force a re-login. */
const REFRESH_TTL_DAYS = 7;

const COOKIE_NAMES: Record<TokenAudience, { access: string; refresh: string }> = {
  user: { access: 'user_at', refresh: 'user_rt' },
  admin: { access: 'admin_at', refresh: 'admin_rt' }
};

export const cookieNamesFor = (aud: TokenAudience) => COOKIE_NAMES[aud];

const secret = (): string => {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error('JWT_SECRET is not set');
  }
  return value;
};

const refreshSecret = (): string => process.env.JWT_REFRESH_SECRET || secret();

export const signAccessToken = (userId: string, role: string, aud: TokenAudience): string => {
  const payload: AccessTokenPayload = { sub: userId, role, aud, typ: 'access' };
  return jwt.sign(payload, secret(), { expiresIn: ACCESS_TTL[aud] } as SignOptions);
};

export const signRefreshToken = (userId: string, aud: TokenAudience, jti: string): string => {
  const payload: RefreshTokenPayload = { sub: userId, aud, typ: 'refresh', jti };
  return jwt.sign(payload, refreshSecret(), {
    expiresIn: `${REFRESH_TTL_DAYS}d`
  } as SignOptions);
};

export const verifyAccessToken = (token: string, aud: TokenAudience): AccessTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, secret()) as AccessTokenPayload;
    // Reject a token minted for the other audience, or a refresh token being
    // presented where an access token is expected.
    if (decoded.typ !== 'access' || decoded.aud !== aud) return null;
    return decoded;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (
  token: string,
  aud: TokenAudience
): RefreshTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, refreshSecret()) as RefreshTokenPayload;
    if (decoded.typ !== 'refresh' || decoded.aud !== aud) return null;
    return decoded;
  } catch {
    return null;
  }
};

/** Opaque id for a refresh token, used as its database key. */
export const newTokenId = (): string => crypto.randomUUID();

/** Refresh tokens are stored hashed, so a database leak does not yield usable tokens. */
export const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

export const refreshExpiryDate = (): Date =>
  new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

const baseCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/'
});

export const setAuthCookies = (
  res: Response,
  aud: TokenAudience,
  accessToken: string,
  refreshToken: string
): void => {
  const names = COOKIE_NAMES[aud];
  const opts = baseCookieOptions();

  res.cookie(names.access, accessToken, {
    ...opts,
    // Deliberately a session cookie: the access token's own expiry is the
    // authority, and the refresh token is what survives a browser restart.
    maxAge: undefined
  });

  res.cookie(names.refresh, refreshToken, {
    ...opts,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000
  });
};

export const clearAuthCookies = (res: Response, aud: TokenAudience): void => {
  const names = COOKIE_NAMES[aud];
  const opts = baseCookieOptions();
  res.clearCookie(names.access, opts);
  res.clearCookie(names.refresh, opts);
};
