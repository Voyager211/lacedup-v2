import type { NextFunction, Request, Response } from 'express';
import { wantsJson } from '../utils/wants-json.util';

export const addUserContext = (req: Request, res: Response, next: NextFunction) => {
  res.locals.user = req.user || null;
  next();
};

// Middleware to ensure user is authenticated
export const ensureAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated via passport (OAuth)
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // Check if user is authenticated via session
  if (req.session && req.session.userId) {
    return next();
  }

  // A request that arrived under /api wanted the API, whatever headers it
  // sent - a 302 to an HTML login page gives an XHR caller nothing to act on.
  if (wantsJson(req)) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
      redirectUrl: '/login'
    });
  }

  return res.redirect('/login');
};

// Middleware to ensure user is not authenticated (for login/register pages)
export const ensureNotAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated via passport (OAuth)
  if (req.isAuthenticated && req.isAuthenticated()) {
    return res.redirect('/');
  }

  // Check if user is authenticated via session
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }

  return next();
};
