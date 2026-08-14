import type { NextFunction, Request, Response } from 'express';
import { findSignup } from '../../modules/auth/pending-signup.service';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  Pragma: 'no-cache',
  Expires: '0',
  'Surrogate-Control': 'no-store'
};

export const preventBackNavigation = (req: Request, res: Response, next: NextFunction) => {
  res.set(NO_CACHE_HEADERS);

  // Check if user is already authenticated (shouldn't access auth pages)
  if (req.isAuthenticated()) {
    return res.redirect('/home');
  }

  next();
};

// Specific middleware for OTP verification pages
export const preventOtpBackNavigation = async (req: Request, res: Response, next: NextFunction) => {
  res.set(NO_CACHE_HEADERS);

  // Check if user is already authenticated
  if (req.isAuthenticated()) {
    return res.redirect('/home');
  }

  // For signup OTP verification, check if there's pending signup data
  if (req.path === '/verify-otp') {
    const email = req.query.email;

    // Looked up in the PendingSignup collection rather than the session, so
    // reloading the OTP page no longer bounces the shopper back to /signup
    // just because their session was dropped.
    if (!email || !(await findSignup(String(email)))) {
      return res.redirect('/signup');
    }
  }

  // For password reset OTP verification, check if there's a valid reset session
  if (req.path === '/reset-otp') {
    const email = req.query.email;
    if (!email) {
      return res.redirect('/forgot-password');
    }
  }

  // For reset password page, check if there's a valid email parameter
  if (req.path === '/reset-password') {
    const email = req.query.email;
    if (!email) {
      return res.redirect('/forgot-password');
    }
  }

  next();
};
