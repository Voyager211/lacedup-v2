import type { NextFunction, Request, Response } from 'express';

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    // Read off the user the JWT resolved, not a session mirror. jwt-auth picks
    // the cookie pair by path, so on an /admin route req.user is only ever set
    // from an admin token - a shopper token cannot satisfy this.
    if (req.user?.role === 'admin') {
      return next();
    }
    req.flash('error', 'Admin access only');
    res.redirect('/admin/login');
  } catch (error) {
    console.error('Error in isAdmin middleware:', error);
    res.status(500).send('Internal Server Error');
  }
};

export = isAdmin;
