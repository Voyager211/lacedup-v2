import type { NextFunction, Request, Response } from 'express';

export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) return next();
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
