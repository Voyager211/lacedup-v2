import type { NextFunction, Request, Response } from 'express';

const isAdmin = (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.isAuthenticated() && req.session.role === 'admin') {
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
