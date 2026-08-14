import { z } from 'zod';

/**
 * Form schemas.
 *
 * These replace the 475-line FormValidator class, the per-page hand-rolled
 * validators, and the pre-rendered `.error-message` divs shipped in the
 * address form markup - three systems whose rules had already drifted apart
 * (FormValidator required a 2-character name; the address form required 4).
 *
 * Three rules are deliberately NOT ports of the old ones:
 *
 *  1. No TLD allowlist. validation.js checked the domain suffix against a
 *     hardcoded list - com, org, net, edu, gov, mil, int, co, in, uk, de, fr,
 *     jp, au, ca - which rejects perfectly valid addresses at .io, .dev, .app
 *     and every other newer TLD. That is a bug, not a safeguard.
 *
 *  2. Names allow apostrophes, hyphens and non-ASCII letters. The old
 *     /^[a-zA-Z\s]+$/ rejected O'Brien, Anne-Marie and any name outside the
 *     English alphabet.
 *
 *  3. New passwords need 8 characters with a letter and a digit, where the old
 *     rule was 6 characters of anything. Note this applies to *setting* a
 *     password - the login schema deliberately checks only that a password was
 *     entered, so existing users with shorter ones can still sign in.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(254, 'That email is too long')
  .pipe(z.email('Enter a valid email address'))
  .transform((value) => value.toLowerCase());

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(50, 'Name must be 50 characters or fewer')
  .regex(/^[\p{L}][\p{L}\s'.-]*$/u, 'Name can only contain letters, spaces, apostrophes and hyphens');

/** Indian mobile numbers: ten digits starting 6-9. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number');

export const newPasswordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be 128 characters or fewer')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const otpSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code');

export const pincodeSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d{5}$/, 'Enter a valid 6-digit pincode');

/* Auth ------------------------------------------------------------------ */

export const loginSchema = z.object({
  email: emailSchema,
  // Length is not checked here on purpose: an existing account may predate the
  // stricter rule below, and refusing to submit it would lock the owner out of
  // their own account rather than let the server say "wrong password".
  password: z.string().min(1, 'Password is required')
});

export const signupSchema = z
  .object({
    name: nameSchema,
    // Required on the form, though the server treats it as optional - the
    // signup design asks for it, and an account with no phone number is a
    // support problem later when a delivery needs chasing.
    phone: phoneSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    referralCode: z.string().trim().toUpperCase().optional().or(z.literal(''))
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: newPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password')
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
  .refine((data) => data.currentPassword !== data.password, {
    message: 'Your new password must be different from the current one',
    path: ['password']
  });

export const otpFormSchema = z.object({ otp: otpSchema });

/* Profile and address --------------------------------------------------- */

export const profileSchema = z.object({
  name: nameSchema,
  phone: phoneSchema.optional().or(z.literal(''))
});

/**
 * Mirrors the 11 fields of the address form the checkout and address book
 * share. The old markup shipped hardcoded copy for each of these in static
 * divs; the copy lives with the rule now.
 */
export const addressSchema = z.object({
  name: nameSchema,
  phone: phoneSchema,
  altPhone: phoneSchema.optional().or(z.literal('')),
  addressType: z.enum(['Home', 'Work', 'Other']),
  landMark: z.string().trim().min(1, 'Landmark is required').max(100),
  city: z.string().trim().min(1, 'City is required').max(60),
  state: z.string().trim().min(1, 'State is required'),
  district: z.string().trim().min(1, 'District is required'),
  pincode: pincodeSchema,
  isDefault: z.boolean().optional()
});

/* Content --------------------------------------------------------------- */

export const contactSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  subject: z.string().trim().min(3, 'Subject is required').max(120),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(2000)
});

export const reviewSchema = z.object({
  rating: z.number().int().min(1, 'Choose a rating').max(5),
  title: z.string().trim().max(120).optional().or(z.literal('')),
  comment: z.string().trim().min(10, 'Please write at least 10 characters').max(2000)
});

/* Inferred types -------------------------------------------------------- */

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
export type ProfileValues = z.infer<typeof profileSchema>;
export type AddressValues = z.infer<typeof addressSchema>;
export type ContactValues = z.infer<typeof contactSchema>;
export type ReviewValues = z.infer<typeof reviewSchema>;
