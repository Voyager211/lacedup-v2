const rateLimit = require('express-rate-limit');

/**
 * Rate limiters.
 *
 * Limits are disabled under NODE_ENV=test so the suite is not throttled into
 * 429s by its own repeated requests.
 */
const isTest = process.env.NODE_ENV === 'test';

const makeLimiter = ({ windowMs, limit, message }) =>
  rateLimit({
    windowMs,
    limit,
    message: { success: false, message },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => isTest
  });

/**
 * Login and signup. Tight, because this is the endpoint an attacker hammers
 * when credential-stuffing.
 */
const authLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many login attempts. Please try again in 15 minutes.'
});

/**
 * OTP request and verification. Each send costs a real email, and an
 * unthrottled verify endpoint lets a 6-digit code be brute-forced.
 */
const otpLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many OTP requests. Please try again in 15 minutes.'
});

/**
 * Password reset requests.
 */
const passwordResetLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many password reset requests. Please try again later.'
});

/**
 * Coupon application - stops the coupon table being enumerated by brute force.
 */
const couponRateLimit = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many coupon attempts, please try again later.'
});

/**
 * Payment initiation and verification.
 */
const paymentLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: 'Too many payment attempts. Please try again shortly.'
});

/**
 * Broad backstop for the whole API surface. Generous enough not to affect
 * normal browsing.
 */
const apiLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  message: 'Too many requests. Please slow down.'
});

module.exports = {
  authLimiter,
  otpLimiter,
  passwordResetLimiter,
  couponRateLimit,
  paymentLimiter,
  apiLimiter
};
