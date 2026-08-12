import type { NextFunction, Request, Response } from 'express';
import User from '../../modules/users/user.model';
import { cookieNamesFor, verifyAccessToken } from '../../modules/auth/jwt.service';

/**
 * Populates req.user from the JWT cookie.
 *
 * Compatibility notes, which is most of why this middleware looks the way it
 * does:
 *
 *  - `req.isAuthenticated()` is replaced with a shim. Passport defined it, and
 *    24 call sites across controllers, middlewares and routers still call it.
 *    Shimming keeps every one of them working unchanged.
 *
 *  - `req.session.userId` is mirrored from the token. 71 places read it, 49 of
 *    them without falling back to req.user. The JWT is the source of truth;
 *    this mirror exists so those reads keep working and is removed once the
 *    EJS layer goes in Phase 5.
 *
 * Which token is read depends on the path: /admin uses the admin cookie pair,
 * everything else the shopper pair. That preserves today's behaviour where one
 * browser can hold an admin and a shopper login at the same time, and means a
 * shopper token cannot satisfy an admin route.
 */
const jwtAuth = async (req: Request, res: Response, next: NextFunction) => {
  const audience = req.path.startsWith('/admin') || req.path.startsWith('/api/admin') ? 'admin' : 'user';
  const names = cookieNamesFor(audience);
  const token = req.cookies?.[names.access];

  // Default the shim before any early return, so downstream code can always
  // call req.isAuthenticated() regardless of how this middleware exits.
  req.isAuthenticated = (() => false) as typeof req.isAuthenticated;

  if (!token) {
    return next();
  }

  const payload = verifyAccessToken(token, audience);
  if (!payload) {
    return next();
  }

  try {
    const user = await User.findById(payload.sub);

    // A user blocked or deleted after the token was issued must not stay signed
    // in until it expires - the token is checked against current state here.
    if (!user || user.isBlocked) {
      return next();
    }

    req.user = user;
    req.isAuthenticated = (() => true) as typeof req.isAuthenticated;

    if (req.session) {
      req.session.userId = String(user._id);
      req.session.role = user.role;
    }

    res.locals.user = user;
  } catch (error) {
    console.error('JWT auth lookup failed:', error);
  }

  next();
};

// `export =` to match the other single-purpose middlewares in this folder.
export = jwtAuth;
