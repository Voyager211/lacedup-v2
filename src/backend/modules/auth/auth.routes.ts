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

const router = express.Router();

/**
 * @swagger
 * /signup:
 *   get:
 *     tags: [Auth]
 *     summary: Signup page
 *     responses:
 *       200: { description: Signup form markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /home when already signed in }
 *   post:
 *     tags: [Auth]
 *     summary: Start signup
 *     description: >
 *       Creates a pending signup in the session and emails an OTP. No user row
 *       is written until the OTP is verified. Rate limited to 10 attempts per
 *       15 minutes per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               confirmPassword: { type: string, format: password }
 *               referralCode: { type: string, description: Optional referral code }
 *     responses:
 *       200: { description: OTP sent; continue at /verify-otp }
 *       400: { description: Validation failed or the email is already registered }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.get('/signup', isGuest, preventBackNavigation, authController.getSignup);
router.post('/signup', authLimiter, isGuest, authController.postSignup);

/**
 * @swagger
 * /verify-otp:
 *   get:
 *     tags: [Auth]
 *     summary: OTP entry page
 *     description: Redirects to /signup unless a matching pending signup exists in the session.
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200: { description: OTP form markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /signup when there is no pending signup }
 *   post:
 *     tags: [Auth]
 *     summary: Verify the signup OTP
 *     description: >
 *       On success the user is created and signed in. Rate limited to 5 attempts
 *       per 15 minutes, which is what stops a 6-digit code being brute-forced.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string, example: '123456' }
 *     responses:
 *       200: { description: Account created and signed in }
 *       400: { description: OTP incorrect or expired }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.get('/verify-otp', isGuest, preventOtpBackNavigation, authController.getOtpPage);
router.post('/verify-otp', otpLimiter, isGuest, authController.postOtpVerification);

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
router.post('/resend-otp', otpLimiter, isGuest, authController.resendOtp);

/**
 * @swagger
 * /login:
 *   get:
 *     tags: [Auth]
 *     summary: Login page
 *     responses:
 *       200: { description: Login form markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /home when already signed in }
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: >
 *       Blocked accounts are refused even with correct credentials. Rate limited
 *       to 10 attempts per 15 minutes per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200: { description: Signed in; a session cookie is set }
 *       401: { description: Invalid credentials, or the account is blocked }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.get('/login', isGuest, preventBackNavigation, authController.getLogin);
router.post('/login', authLimiter, isGuest, authController.postLogin);

/**
 * @swagger
 * /forgot-password:
 *   get:
 *     tags: [Auth]
 *     summary: Forgot password page
 *     responses:
 *       200: { description: Form markup, content: { text/html: { schema: { type: string } } } }
 *   post:
 *     tags: [Auth]
 *     summary: Send a password reset OTP
 *     description: Limited to 5 requests per hour per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200: { description: OTP sent if the account exists }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.get('/forgot-password', isGuest, preventBackNavigation, authController.getForgotPassword);
router.post('/forgot-password', passwordResetLimiter, isGuest, authController.sendResetOtp);

/**
 * @swagger
 * /reset-otp:
 *   get:
 *     tags: [Auth]
 *     summary: Reset OTP entry page
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200: { description: OTP form markup, content: { text/html: { schema: { type: string } } } }
 *       302: { description: Redirected to /forgot-password when the email is missing }
 *   post:
 *     tags: [Auth]
 *     summary: Verify the password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string }
 *     responses:
 *       200: { description: OTP verified; continue at /reset-password }
 *       400: { description: OTP incorrect or expired }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.get('/reset-otp', isGuest, preventOtpBackNavigation, authController.getResetOtpPage);
router.post('/reset-otp', otpLimiter, isGuest, authController.verifyResetOtp);

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
router.post('/resend-reset-otp', otpLimiter, isGuest, authController.resendResetOtp);

/**
 * @swagger
 * /reset-password:
 *   get:
 *     tags: [Auth]
 *     summary: New password page
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200: { description: Form markup, content: { text/html: { schema: { type: string } } } }
 *   post:
 *     tags: [Auth]
 *     summary: Set a new password
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *               confirmPassword: { type: string, format: password }
 *     responses:
 *       200: { description: Password reset }
 *       400: { description: Validation failed, or the reset was not verified }
 *       429: { $ref: '#/components/responses/RateLimited' }
 */
router.get('/reset-password', isGuest, preventOtpBackNavigation, authController.getResetPasswordPage);
router.post('/reset-password', passwordResetLimiter, isGuest, authController.resetPassword);

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

    req.login(user, (loginErr) => {
      if (loginErr) {
        console.error('Login error after OAuth:', loginErr);
        return res.redirect('/login?error=login_failed');
      }
      return res.redirect('/home');
    });
  })(req, res, next);
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
