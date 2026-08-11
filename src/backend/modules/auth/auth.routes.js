const express = require('express');
const passport = require('passport');
const authController = require('./auth.controller');
const nocache = require('../../common/middlewares/nocache.middleware')
const { preventBackNavigation, preventOtpBackNavigation } = require('../../common/middlewares/prevent-back-navigation.middleware');
const { isGuest } = require('../../common/middlewares/auth.middleware');
const {
  authLimiter,
  otpLimiter,
  passwordResetLimiter
} = require('../../common/middlewares/rate-limiting.middleware'); 

const router = express.Router();

// === Signup ===
router.get('/signup', isGuest, preventBackNavigation, authController.getSignup);
router.post('/signup', authLimiter, isGuest, authController.postSignup);

// === OTP Verification ===
router.get('/verify-otp', isGuest, preventOtpBackNavigation, authController.getOtpPage);
router.post('/verify-otp', otpLimiter, isGuest, authController.postOtpVerification);
router.post('/resend-otp', otpLimiter, isGuest, authController.resendOtp);



// === Login ===
router.get('/login', isGuest, preventBackNavigation, authController.getLogin);
router.post('/login', authLimiter, isGuest, authController.postLogin);

// === Forgot Password Flow ===
router.get('/forgot-password', isGuest, preventBackNavigation, authController.getForgotPassword);
router.post('/forgot-password', passwordResetLimiter, isGuest, authController.sendResetOtp);

router.get('/reset-otp', isGuest, preventOtpBackNavigation, authController.getResetOtpPage);
router.post('/reset-otp', otpLimiter, isGuest, authController.verifyResetOtp);
router.post('/resend-reset-otp', otpLimiter, isGuest, authController.resendResetOtp);

router.get('/reset-password', isGuest, preventOtpBackNavigation, authController.getResetPasswordPage);
router.post('/reset-password', passwordResetLimiter, isGuest, authController.resetPassword);



// === Google Login ===
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
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

// Test route for email configuration (remove in production)
router.get('/test-email', async (req, res) => {
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
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;