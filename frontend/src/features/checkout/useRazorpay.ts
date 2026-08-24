import { useCallback, useRef } from 'react';

/**
 * Loads the Razorpay Checkout script, once.
 *
 * The EJS pages put a `<script>` tag in the markup, so every visitor paid for
 * it whether or not they ever reached checkout. Here it is fetched on demand
 * and the promise is cached, so opening the payment sheet twice does not load
 * it twice.
 */
const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccess) => void;
  modal?: { ondismiss?: () => void };
}

let scriptPromise: Promise<boolean> | null = null;

const loadRazorpay = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      // Let a later attempt retry rather than caching the failure forever -
      // a blocked script or a dropped connection should not permanently
      // disable card payments for the session.
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptPromise;
};

export interface OpenRazorpayArgs {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  customer?: { name?: string; email?: string; contact?: string };
  onSuccess: (response: RazorpaySuccess) => void;
  /** Called when the sheet is dismissed, or the script cannot be loaded. */
  onDismiss: (reason: 'dismissed' | 'unavailable') => void;
}

/**
 * Opens the Razorpay payment sheet.
 *
 * Dismissal is reported, not ignored. A shopper who closes the sheet has a
 * Razorpay order and a server-side snapshot outstanding, and the caller needs
 * to record that so the retry page has something to show - otherwise the
 * attempt vanishes and they are left wondering whether they were charged.
 *
 * Re-entry is guarded: two open sheets for one cart would mean two payments.
 */
export const useRazorpay = () => {
  const isOpen = useRef(false);

  return useCallback(async (args: OpenRazorpayArgs) => {
    if (isOpen.current) return;

    const ready = await loadRazorpay();

    if (!ready || !window.Razorpay) {
      args.onDismiss('unavailable');
      return;
    }

    isOpen.current = true;

    const checkout = new window.Razorpay({
      key: args.keyId,
      amount: args.amount,
      currency: args.currency,
      name: 'LacedUp Co.',
      description: 'Order payment',
      order_id: args.orderId,
      ...(args.customer ? { prefill: args.customer } : {}),
      theme: { color: '#E03A2F' },
      handler: (response) => {
        isOpen.current = false;
        args.onSuccess(response);
      },
      modal: {
        ondismiss: () => {
          isOpen.current = false;
          args.onDismiss('dismissed');
        }
      }
    });

    checkout.open();
  }, []);
};
