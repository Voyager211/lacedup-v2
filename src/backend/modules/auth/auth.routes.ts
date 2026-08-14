import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import passport from 'passport';
import * as authController from './auth.controller';
import { preventBackNavigation, preventOtpBackNavigation } from '../../common/middlewares/prevent-back-navigation.middleware';
import { isGuest } from '../../common/middlewares/auth.middleware';
import {
  authLimiter,
  otpLimiter,
  passwordResetLimiter
} from '../../common/middlewares/rate-limiting.middleware';
import { endSession, issueSession, rotateSession } from './auth.session';
import { publicUser } from '../users/user.serializer';

const router = express.Router();

/*
 * Each of these is registered on its bare path and under /api.
 *
 * This router is root-mounted and deliberately not dual-mounted (app.ts), so
 * only the bare path existed - the EJS forms post there. The SPA sends
 * everything through an /api base URL, so without the second path every auth
 * call from React 404s. Same reasoning as the other root-mounted routers,
 * which already declare 47 of their own /api endpoints.
 */
router.post('/api/signup', authLimiter, isGuest, authController.postSignup);

router.post('/api/verify-otp', otpLimiter, isGuest, authController.postOtpVerification);

/**
 * @swagger
 * /resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the signup OTP
 *     responses:
 *       200: { description: OTP resent }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/api/resend-otp', otpLimiter, isGuest, authController.resendOtp);

router.post('/api/login', authLimiter, isGuest, authController.postLogin);

router.post('/api/forgot-password', passwordResetLimiter, isGuest, authController.sendResetOtp);

router.post('/api/reset-otp', otpLimiter, isGuest, authController.verifyResetOtp);

/**
 * @swagger
 * /resend-reset-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend the password reset OTP
 *     responses:
 *       200: { description: OTP resent }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.post('/api/resend-reset-otp', otpLimiter, isGuest, authController.resendResetOtp);

router.post('/api/reset-password', passwordResetLimiter, isGuest, authController.resetPassword);

/**
 * @swagger
 * /google:
 *   get:
 *     tags: [Auth]
 *     summary: Begin Google OAuth
 *     description: Redirects to Google's consent screen, requesting the profile and email scopes.
 *     responses:
 *       302: { description: Redirected to Google }
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * @swagger
 * /google/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Google OAuth callback
 *     description: >
 *       Signs the user in and redirects to /home. Failures redirect back to
 *       /login with an `error` query parameter - `oauth_error`, `oauth_failed`,
 *       `login_failed`, or `blocked` for a blocked account.
 *     responses:
 *       302: { description: Redirected to /home on success, or /login with an error }
 */
router.get('/google/callback', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('google', (err: any, user: any, info: any) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect('/login?error=oauth_error');
    }

    if (!user) {
      // Check if it's a blocked user error
      if (info && info.message && info.message.includes('blocked')) {
        return res.redirect('/login?error=blocked&message=' + encodeURIComponent(info.message));
      }
      return res.redirect('/login?error=oauth_failed');
    }

    // OAuth succeeded - issue the JWT pair rather than a passport session.
    issueSession(res, user, 'user')
      .then(() => res.redirect('/home'))
      .catch((issueErr) => {
        console.error('Login error after OAuth:', issueErr);
        return res.redirect('/login?error=login_failed');
      });
  })(req, res, next);
});

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange the refresh cookie for a new token pair
 *     description: >
 *       Rotates the refresh token: the presented one is revoked as part of the
 *       exchange, so it is single-use. Replaying a captured token after the
 *       legitimate client has refreshed finds it already revoked and fails.
 *       Reads and sets httpOnly cookies - there is no request or response body.
 *     responses:
 *       200: { description: New access and refresh cookies issued }
 *       401: { description: Refresh token missing, expired, already used, or revoked }
 */
router.post('/api/auth/refresh', async (req: Request, res: Response) => {
  const presented = req.cookies?.user_rt;

  if (!presented) {
    return res.status(401).json({ success: false, message: 'No refresh token' });
  }

  const result = await rotateSession(res, presented, 'user');

  if (!result.ok) {
    return res.status(401).json({ success: false, message: result.reason });
  }

  return res.json({ success: true });
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: The currently signed-in shopper
 *     description: >
 *       Reports who the access cookie belongs to. The SPA needs this because
 *       the auth cookies are httpOnly and therefore invisible to JavaScript -
 *       without it the client cannot tell a signed-in visitor from a signed-out
 *       one except by making a request and watching it fail.
 *
 *       Returns 401 rather than a null user when there is no valid session, so
 *       it goes through the same refresh-then-retry path as every other call.
 *       The password and OTP fields are never included.
 *     responses:
 *       200:
 *         description: The signed-in user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     name: { type: string }
 *                     email: { type: string }
 *                     phone: { type: string }
 *                     profilePhoto: { type: string }
 *                     role: { type: string, enum: [user, admin] }
 *                     isBlocked: { type: boolean }
 *                     referralCode: { type: string }
 *                     referralCount: { type: integer }
 *       401: { description: No valid session }
 */
/*
 * Declared with the /api prefix in the path rather than relying on a mount.
 * This router is root-mounted and deliberately not dual-mounted under /api -
 * it declares its own /api/... endpoints internally, as the other root-mounted
 * routers already do for their 47 JSON routes. There is no bare /auth/me
 * because nothing but the SPA ever calls it.
 */
router.get('/api/auth/me', (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  return res.json({ success: true, user: publicUser(req.user) });
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: End the shopper session (JSON)
 *     description: >
 *       The SPA counterpart of GET /logout. Same effect - the refresh token row
 *       is revoked, both cookies are cleared and the session is destroyed - but
 *       it answers with JSON instead of a 302 to an HTML page, which an XHR
 *       client would only follow and discard.
 *     responses:
 *       200: { description: Session ended }
 */
router.post('/api/auth/logout', async (req: Request, res: Response) => {
  await endSession(res, req.cookies?.user_rt, 'user');

  res.json({ success: true });
});

router.get('/logout', authController.logout);

/**
 * Diagnostic endpoint. It reports the configured EMAIL_USER and the length of
 * EMAIL_PASS, so it is now registered only outside production - the original
 * comment on it said "remove in production" but nothing enforced that.
 */
if (process.env.NODE_ENV !== 'production') {
  /**
   * @swagger
   * /test-email:
   *   get:
   *     tags: [Auth]
   *     summary: Check the SMTP configuration (non-production only)
   *     description: >
   *       Verifies the nodemailer transporter and echoes the configured
   *       EMAIL_USER plus the length of EMAIL_PASS. Not registered when
   *       NODE_ENV=production.
   *     responses:
   *       200:
   *         description: Configuration status
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success: { type: boolean }
   *                 message: { type: string }
   *       500: { $ref: '#/components/responses/ServerError' }
   */
  router.get('/test-email', async (_req: Request, res: Response) => {
    try {
      const { testEmailConfig } = require('../../common/utils/send-email.util');
      const isConfigValid = await testEmailConfig();

      res.json({
        success: isConfigValid,
        message: isConfigValid ? 'Email configuration is working' : 'Email configuration failed',
        env: {
          EMAIL_USER: process.env.EMAIL_USER,
          EMAIL_PASS_LENGTH: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 0
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  });
}

export = router;
