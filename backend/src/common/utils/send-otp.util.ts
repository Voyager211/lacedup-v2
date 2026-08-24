import ejs from 'ejs';
import path from 'path';
import fs from 'fs';
import sendEmail from './send-email.util';
import mockSendEmail from './mock-email.util';
import { EMAIL_TEMPLATES_DIR } from '../../config/paths';

/**
 * Minimal user shape needed to address an OTP email.
 *
 * Deliberately NOT exported: this module uses `export =` so its require() call
 * sites stay unchanged, and a module using `export =` cannot export anything
 * else. Mixing them is illegal TypeScript that TypeScript 7 does not diagnose -
 * it fails at runtime with "send_otp_util_module is not defined".
 */
interface OtpRecipient {
  email: string;
  name?: string;
}

/**
 * Use the mock sender when real email cannot possibly work, or when explicitly
 * requested.
 *
 * This previously checked only EMAIL_USER. With EMAIL_USER set but EMAIL_PASS
 * blank, send-email.util builds no transporter and throws, yet the mock
 * fallback did not engage - so OTP signup failed outright on a half-configured
 * environment. Both credentials are now required before the real sender is used.
 */
const USE_MOCK_EMAIL =
  !process.env.EMAIL_USER || !process.env.EMAIL_PASS || process.env.MOCK_EMAIL === 'true';

// Pre-compile template for faster rendering
const templatePath = path.join(EMAIL_TEMPLATES_DIR, 'otp-email.ejs');

type TemplateFn = (data: { user: OtpRecipient; otp: string }) => string;
type FallbackFn = (user: OtpRecipient, otp: string) => string;

let compiledTemplate: TemplateFn | null = null;

const fallbackHtml: FallbackFn = (user, otp) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">Your OTP Code</h2>
      <p>Hello ${user.name || 'Valued Customer'},</p>
      <p>Your OTP code is: <strong style="font-size: 24px; color: #667eea;">${otp}</strong></p>
      <p style="color: #856404; background-color: #fff3cd; padding: 10px; border-radius: 5px;">
        ⏰ This code will expire in 2 minutes.
      </p>
      <p style="color: #666;">— LacedUp Co. Team</p>
    </div>
  `;

// Initialize template on module load
const initializeTemplate = (): void => {
  try {
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      compiledTemplate = ejs.compile(templateContent) as TemplateFn;
    } else {
      console.warn('⚠️ OTP email template not found, using fallback HTML');
    }
  } catch (error) {
    console.warn('⚠️ Failed to pre-compile OTP template:', (error as Error).message);
  }
};

initializeTemplate();

const SUBJECT = 'Your OTP Code - LacedUp';

const deliver = (to: string, html: string): Promise<void> => {
  if (USE_MOCK_EMAIL) {
    console.log(' Using mock email service for OTP');
    return mockSendEmail(to, SUBJECT, html);
  }
  return sendEmail(to, SUBJECT, html);
};

/**
 * Sends an OTP email using the pre-compiled template, falling back to inline
 * HTML if the template is unavailable or rendering fails.
 */
const sendOtp = async (user: OtpRecipient, otp: string): Promise<void> => {
  try {
    let html: string;

    // Use pre-compiled template for faster rendering
    if (compiledTemplate) {
      html = compiledTemplate({
        user: {
          name: user.name || 'Valued Customer',
          email: user.email
        },
        otp: otp
      });
    } else {
      // Use fallback HTML if template compilation failed
      html = fallbackHtml(user, otp);
    }

    await deliver(user.email, html);

    console.log(` OTP email sent successfully to ${user.email}`);
  } catch (error) {
    console.error(' Error sending OTP email:', error);

    // Fallback to basic HTML if template rendering fails
    try {
      await deliver(user.email, fallbackHtml(user, otp));
      console.log(` Fallback OTP email sent successfully to ${user.email}`);
    } catch (fallbackError) {
      console.error(' Fallback email also failed:', fallbackError);
      throw error; // Re-throw original error
    }
  }
};

export = sendOtp;
