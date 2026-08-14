import type { NextFunction, Request, Response } from 'express';
import { wantsJson } from '../utils/wants-json.util';
import { isSignedIn } from '../utils/current-user.util';

export const addUserContext = (req: Request, res: Response, next: NextFunction) => {
  res.locals.user = req.user || null;
  next();
};

// Middleware to ensure user is authenticated
export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (isSignedIn(req)) {
    return next();
  }

  // A request that arrived under /api wanted the API, whatever headers it
  // sent - a 302 to an HTML login page gives an XHR caller nothing to act on.
  return res.status(401).json({
    success: false,
    message: 'Authentication required',
    redirectUrl: '/login'
  });
};

// Middleware to ensure user is not authenticated (for login/register pages)
export const ensureNotAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (isSignedIn(req)) {
    return res.redirect('/');
  }

  return next();
};
