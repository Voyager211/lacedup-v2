import type { NextFunction, Request, Response } from 'express';
import { wantsJson } from '../utils/wants-json.util';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) return next();

  // A request that arrived under /api wanted the API. Redirecting it to a page
  // means an XHR caller silently receives HTML with a 200, which reads as
  // success - worse than an error it can act on.
  if (wantsJson(req)) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  return res.redirect('/'); // Landing page
};

export const isGuest = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) return next();
  return res.redirect('/home'); // Redirect logged-in users
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  // For API routes, return JSON error
  if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  // For page routes, redirect to login
  return res.redirect('/admin/login');
};
