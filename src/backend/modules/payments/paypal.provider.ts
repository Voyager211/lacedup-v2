import paypal from '@paypal/checkout-server-sdk';
import '../../config/env';

/**
 * The PayPal client is created on first use rather than at module load, for the
 * same reason as the Razorpay provider: importing this module must not require
 * live credentials.
 *
 * Still pinned to SandboxEnvironment - switch to LiveEnvironment with live keys.
 */
let paypalClient: paypal.core.PayPalHttpClient | null = null;

export const getPaypalClient = (): paypal.core.PayPalHttpClient => {
  if (!paypalClient) {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      throw new Error('PayPal is not configured: set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET');
    }
    const environment = new paypal.core.SandboxEnvironment(
      process.env.PAYPAL_CLIENT_ID,
      process.env.PAYPAL_CLIENT_SECRET
    );
    paypalClient = new paypal.core.PayPalHttpClient(environment);
  }
  return paypalClient;
};
