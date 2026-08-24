import { api as client } from '@/api/client';

/**
 * The signup, OTP and password-reset calls.
 *
 * Kept out of RTK Query deliberately: none of these read data worth caching,
 * they are all one-shot commands whose result is a navigation, and the OTP
 * flows are stateful on the server (the pending signup lives in the session
 * until it is verified). Plain functions are the honest shape for that.
 *
 * All of them post JSON. The endpoints accept either, since express.json and
 * express.urlencoded are both mounted - only /login and /admin/login need to
 * stay form-encoded, because the EJS forms still post to them.
 */

interface SuccessResponse {
  success: boolean;
  redirect?: string;
}

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
}

/**
 * Starts a signup. No user row is created here - the details sit in the server
 * session until the OTP is verified, which is why the next step needs the same
 * email and why a lost session sends the visitor back to the start.
 *
 * 409 means the email is taken; 400 covers a bad referral code.
 */
export const signup = async (payload: SignupPayload): Promise<void> => {
  await client.post<SuccessResponse>('/signup', payload, { _skipAuthRefresh: true } as never);
};

/**
 * Verifies a signup OTP.
 *
 * On success the server creates the account **and issues the session** - so
 * the visitor is signed in when this resolves, and the caller should bootstrap
 * the session rather than send them to the login page.
 *
 * 401 is a wrong code, 410 an expired one. They are worth telling apart: the
 * first invites a retry, the second means starting over.
 */
export const verifySignupOtp = async (email: string, otp: string): Promise<void> => {
  await client.post<SuccessResponse>(
    '/verify-otp',
    { email, otp },
    { _skipAuthRefresh: true } as never
  );
};

export const resendSignupOtp = async (email: string): Promise<void> => {
  await client.post('/resend-otp', { email }, { _skipAuthRefresh: true } as never);
};

/**
 * Requests a password-reset code.
 *
 * Answers 404 for an unknown address, which discloses whether an account
 * exists. That is the server's existing behaviour and is left alone here
 * rather than silently papered over - see the open items in the README.
 */
export const requestPasswordReset = async (email: string): Promise<void> => {
  await client.post('/forgot-password', { email }, { _skipAuthRefresh: true } as never);
};

export const verifyResetOtp = async (email: string, otp: string): Promise<void> => {
  await client.post('/reset-otp', { email, otp }, { _skipAuthRefresh: true } as never);
};

export const resendResetOtp = async (email: string): Promise<void> => {
  await client.post('/resend-reset-otp', { email }, { _skipAuthRefresh: true } as never);
};

/**
 * Sets the new password.
 *
 * The field is `newPassword`, not `password` - the endpoint differs from every
 * other password form in the app.
 */
export const resetPassword = async (
  email: string,
  newPassword: string,
  confirmPassword: string
): Promise<void> => {
  await client.post(
    '/reset-password',
    { email, newPassword, confirmPassword },
    { _skipAuthRefresh: true } as never
  );
};
