import crypto from 'crypto';
import User from '../users/user.model';

/**
 * Generate a unique referral code.
 *
 * Format: 6-character alphanumeric code (e.g. ABC123). Retries on collision,
 * then falls back to a timestamp-derived code.
 */
export async function generateReferralCode(): Promise<string> {
  const maxAttempts = 5;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate 6-character code using a random string
    const randomPart = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = randomPart.substring(0, 6);

    // Check if code already exists
    const existing = await User.findOne({ referralCode: code });

    if (!existing) {
      return code;
    }

    attempts++;
  }

  // Fallback: use timestamp-based code
  const timestamp = Date.now().toString(36).toUpperCase();
  return timestamp.substring(timestamp.length - 6);
}
