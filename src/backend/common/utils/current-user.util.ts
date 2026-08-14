import type { Request } from 'express';
import type { Types } from 'mongoose';

/**
 * The signed-in user's id, or undefined.
 *
 * This replaces four interchangeable idioms that had spread across the
 * controllers while auth was being moved:
 *
 *   req.user ? req.user!._id : req.session.userId
 *   req.session.userId || (req.user && req.user!._id)
 *   req.session.userId || req.user!._id
 *   req.user?.id || req.session.userId
 *
 * All four existed because the session and Passport disagreed about where the
 * id lived. Since Phase 3 the JWT cookie is the single source of truth and
 * `jwt-auth.middleware` populates `req.user` from it, so the session half of
 * every one of those expressions was already dead - it was only ever read back
 * from a mirror the same middleware had just written.
 *
 * Returns the ObjectId rather than a string because that is what the majority
 * of call sites passed to Mongoose queries; `String()` it where an identity
 * comparison is wanted, since two ObjectIds for the same document are not `===`.
 */
export const currentUserId = (req: Request): Types.ObjectId | undefined =>
  req.user ? (req.user._id as Types.ObjectId) : undefined;

/**
 * The same, for routes that are behind an auth guard.
 *
 * Throws rather than returning undefined, because on a guarded route there is
 * no sensible way to continue without a user - a query built with `undefined`
 * either matches nothing or, worse, matches broadly.
 *
 * This is not a new failure mode. The expressions this replaced ended in
 * `req.user!._id`, which threw a TypeError on `undefined` and surfaced as a 500
 * from the surrounding catch. The only change is that the error now says what
 * went wrong.
 */
export const requireUserId = (req: Request): Types.ObjectId => {
  const id = currentUserId(req);

  if (!id) {
    throw new Error('requireUserId called on a request with no authenticated user');
  }

  return id;
};

/** True when the request carries a valid session for its audience. */
export const isSignedIn = (req: Request): boolean => Boolean(req.user);
