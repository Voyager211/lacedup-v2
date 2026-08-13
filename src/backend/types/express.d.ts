import type { IUser } from '../modules/users/user.types';

/**
 * Express request augmentation.
 *
 * Passport populates `req.user` and several middlewares read it directly, so
 * without this every converted middleware and controller would need a cast.
 *
 * `req.session.userId` is declared alongside it because this codebase has two
 * parallel auth paths - passport's `req.isAuthenticated()` and a raw
 * `req.session.userId`. They get unified in Phase 3 (JWT); until then both must
 * type-check.
 */
declare global {
  namespace Express {
    // Passport merges its own `User` into this namespace; naming the shape here
    // is what makes `req.user` resolve to our document type.
    interface User extends IUser {}
  }
}

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** Set on admin login; read by the isAdmin middleware. */
    role?: string;
    /** Signup details held between OTP request and verification. */
    pendingUser?: {
      email: string;
      name?: string;
      password?: string;
      [key: string]: unknown;
    };
    /** Email pending OTP verification during an email change. */
    pendingEmail?: string;
    /** OTP challenge held while the user confirms an email change. */
    // Two flows write this with slightly different shapes (email change vs
    // OTP re-send), so everything past `otp` is optional.
    emailChangeOtp?: {
      otp: string;
      currentEmail?: string;
      email?: string;
      newEmail?: string;
      userId?: unknown;
      expiresAt?: number;
      [key: string]: unknown;
    } | null;
    /** Current email, mirrored into the session by the profile flow. */
    email?: string;

    /*
     * `pendingRazorpayOrder` used to live here - the snapshot held between
     * creating a Razorpay order and verifying the payment. It now lives in the
     * PendingOrder collection, keyed by the Razorpay order id, so verification
     * no longer depends on the session surviving the trip to the payment
     * provider and back. See modules/checkout/pending-order.model.ts.
     */

    /** Details of the last failed payment, used to render the retry page. */
    paymentFailure?: {
      transactionId?: string;
      reason?: string;
      failedAt?: Date;
      orderId?: unknown;
      orderNumber?: string;
      /**
       * Snapshot of the attempted order (items, address, totals). Deliberately
       * loose: it is rebuilt from several different code paths and is only
       * used to re-render the retry page.
       */
      orderData?: any;
      [key: string]: unknown;
    } | null;

    errorMessage?: string;
    /** Coupon applied to the current checkout, held until the order is placed. */
    appliedCoupon?: {
      code: string;
      name?: string;
      discountAmount?: number;
      [key: string]: unknown;
    } | null;
    [key: string]: unknown;
  }
}

export {};
