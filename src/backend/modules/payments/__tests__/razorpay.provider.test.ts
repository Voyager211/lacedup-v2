import crypto from 'crypto';
import {
  verifyPaymentSignature,
  getRazorpayInstance
} from '../razorpay.provider';

const KEY_SECRET = 'test_secret_key';

const sign = (orderId: string, paymentId: any, secret = KEY_SECRET) =>
  crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');

describe('razorpay provider', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('verifyPaymentSignature', () => {
    it('accepts a signature produced with the correct secret', () => {
      const sig = sign('order_ABC123', 'pay_XYZ789');
      expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', sig)).toBe(true);
    });

    it('rejects a signature generated with a different secret', () => {
      const sig = sign('order_ABC123', 'pay_XYZ789', 'attacker_secret');
      expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', sig)).toBe(false);
    });

    // A payment proof must not be transferable between orders, otherwise one
    // successful payment could be replayed to mark other orders as paid.
    it('rejects a valid signature replayed against a different order', () => {
      const sig = sign('order_ABC123', 'pay_XYZ789');
      expect(verifyPaymentSignature('order_DIFFERENT', 'pay_XYZ789', sig)).toBe(false);
    });

    it('rejects a valid signature replayed with a different payment id', () => {
      const sig = sign('order_ABC123', 'pay_XYZ789');
      expect(verifyPaymentSignature('order_ABC123', 'pay_OTHER', sig)).toBe(false);
    });

    it('rejects an empty or malformed signature instead of throwing', () => {
      expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', '')).toBe(false);
      expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', 'not-a-signature')).toBe(false);
    });

    it('returns false rather than throwing when the secret is missing', () => {
      delete process.env.RAZORPAY_KEY_SECRET;
      expect(verifyPaymentSignature('order_ABC123', 'pay_XYZ789', 'anything')).toBe(false);
    });
  });

  describe('getRazorpayInstance', () => {
    // Regression guard: the client used to be constructed at module load, which
    // crashed the entire app at boot when credentials were absent and made this
    // module impossible to import in a test.
    it('throws a clear configuration error when credentials are missing', () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;
      expect(() => getRazorpayInstance()).toThrow(/not configured/i);
    });
  });
});
