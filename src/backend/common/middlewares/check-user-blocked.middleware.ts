import type { NextFunction, Request, Response } from 'express';
import User from '../../modules/users/user.model';
import { endSession, revokeAllSessions } from '../../modules/auth/auth.session';

/**
 * Helper to safely handle user logout with flash messages.
 * Sets the flash message before destroying the session to prevent crashes.
 */
function handleUserLogout(req: Request, res: Response, errorMessage: string) {
  // Check if this is an AJAX request
  const isAjaxRequest =
    req.xhr || (req.headers && req.headers.accept && req.headers.accept.indexOf('json') > -1);

  if (isAjaxRequest) {
    // For AJAX requests, return JSON response immediately
    return res.status(403).json({
      error: errorMessage,
      blocked: true,
      redirect: '/login'
    });
  }

  // For regular requests, handle session safely
  try {
    // Set flash message BEFORE destroying session (if session exists)
    if (req.session && typeof req.flash === 'function') {
      req.flash('error', errorMessage);
    }

    // Revoke every outstanding token for this user, then clear the cookies.
    // A blocked user must not stay signed in until their access token expires,
    // and must not be able to refresh into a new one.
    void (async () => {
      try {
        if (req.user?._id) {
          await revokeAllSessions(req.user._id);
        }
        await endSession(res, req.cookies?.user_rt, 'user');
      } catch (revokeErr) {
        console.error('Failed to revoke sessions for blocked user:', revokeErr);
      }

      // Destroy session safely
      if (req.session && typeof req.session.destroy === 'function') {
        req.session.destroy((destroyErr) => {
          if (destroyErr) {
            console.error('Session destroy error:', destroyErr);
          }
          res.clearCookie('connect.sid');

          // If flash message couldn't be set, redirect with URL parameter
          if (!req.session || typeof req.flash !== 'function') {
            return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
          }

          return res.status(401).json({ success: false, message: 'Authentication required' });
        });
      } else {
        // Session already destroyed or doesn't exist
        res.clearCookie('connect.sid');
        return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
      }
    })();
  } catch (error) {
    // Fallback for any unexpected errors
    console.error('Error in handleUserLogout:', error);
    res.clearCookie('connect.sid');
    return res.redirect('/login?error=' + encodeURIComponent(errorMessage));
  }
}

/**
 * Checks whether the currently logged-in user has been blocked.
 * If so, logs them out and redirects with an error message.
 */
const checkUserBlocked = async (req: Request, res: Response, next: NextFunction) => {
  // Skip check for non-authenticated users
  if (!req.isAuthenticated() || !req.user) {
    return next();
  }

  // Skip check for admin users
  if (req.user.role === 'admin') {
    return next();
  }

  // Skip check for auth-related routes to prevent infinite redirects
  const authRoutes = [
    '/login',
    '/logout',
    '/signup',
    '/verify-otp',
    '/forgot-password',
    '/reset-password'
  ];
  if (authRoutes.some((route) => req.path.includes(route))) {
    return next();
  }

  try {
    // Fetch fresh user data from database to check current block status
    const currentUser = await User.findById(req.user._id);

    if (!currentUser) {
      // User doesn't exist anymore, log them out
      return handleUserLogout(req, res, 'User account not found. Please log in again.');
    }

    if (currentUser.isBlocked) {
      // User is blocked, log them out and show error
      return handleUserLogout(
        req,
        res,
        'Your account has been blocked. Please contact support for assistance.'
      );
    }

    // User is not blocked, continue
    next();
  } catch (error) {
    console.error('Error checking user block status:', error);
    // On error, continue to avoid breaking the application
    next();
  }
};

export = checkUserBlocked;
