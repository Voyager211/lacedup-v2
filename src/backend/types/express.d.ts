import type { IUser } from '../modules/users/user.types';

/**
 * Express request augmentation.
 *
 * `jwt-auth.middleware` populates `req.user` from the access-token cookie and
 * several middlewares read it directly, so without this every middleware and
 * controller would need a cast.
 *
 * This file used to carry a second block declaring everything the session held:
 * the signup and email-change OTP flows, the applied coupon, the Razorpay
 * basket, the last payment failure, and a mirror of the signed-in user's id.
 * All of it is gone as of Phase 5 - each moved to a collection of its own, and
 * express-session with it - so there is nothing left to declare.
 *
 * Where each went:
 *   pendingUser          -> modules/auth/pending-signup.model
 *   emailChangeOtp       -> modules/users/email-change.model
 *   appliedCoupon        -> the Cart document, via coupons/applied-coupon.service
 *   pendingRazorpayOrder -> modules/checkout/pending-order.model
 *   paymentFailure       -> rebuilt from the Order, via checkout/payment-failure.service
 *   userId / role        -> read from req.user, via common/utils/current-user.util
 */
declare global {
  namespace Express {
    // Passport merges its own `User` into this namespace; naming the shape here
    // is what makes `req.user` resolve to our document type.
    interface User extends IUser {}
  }
}

export {};
