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
    [key: string]: unknown;
  }
}

export {};
