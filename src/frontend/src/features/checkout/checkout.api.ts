import { api } from '@/api/api';
import type { CartItem } from '@/features/cart/cart.api';

/**
 * Checkout endpoints.
 *
 * `deliveryAddressId` + `addressIndex` is not a mistake: addresses are stored
 * as an array inside one document per user, so a line is identified by the
 * document id plus its position. Both are required by place-order and by the
 * Razorpay create call.
 */

export interface AddressLine {
  _id?: string;
  name: string;
  phone: string;
  altPhone?: string;
  addressType: string;
  landMark: string;
  city: string;
  district?: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}

export interface CheckoutSummary {
  success: boolean;
  cartItems: CartItem[];
  addresses: AddressLine[];
  addressDocumentId: string | null;
  totalItemCount: number;
  totalDiscount: number;
  subtotal: number;
  amountAfterDiscount: number;
  couponDiscount: number;
  appliedCoupon: { code?: string; _id?: string } | null;
  shipping: number;
  total: number;
  walletBalance: number;
}

export type PaymentMethod = 'cod' | 'upi' | 'wallet';

export interface PlaceOrderArgs {
  deliveryAddressId: string;
  addressIndex: number;
  paymentMethod: PaymentMethod;
}

export interface OrderResult {
  success: boolean;
  message?: string;
  orderId?: string;
  data?: { redirectUrl?: string; orderId?: string; orderNumber?: string };
}

export interface RazorpayOrderResult {
  success: boolean;
  data: {
    razorpayOrderId: string;
    amount: number;
    currency: string;
    keyId: string;
    [key: string]: unknown;
  };
}

export interface StockValidation {
  success: boolean;
  invalidItems?: Array<{ productName?: string; message?: string; [key: string]: unknown }>;
  message?: string;
}

/** Everything an order touches, so a placed order refreshes all of it. */
const AFTER_ORDER = ['Cart', 'CartCount', 'Order', 'Wallet', 'Coupon'] as const;

export const checkoutApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCheckout: build.query<CheckoutSummary, void>({
      query: () => ({ url: '/checkout' }),
      providesTags: ['Cart', 'Address', 'Coupon']
    }),

    /**
     * Revalidates stock immediately before payment.
     *
     * Called separately rather than folded into place-order because the
     * shopper should learn a size sold out *before* a payment sheet opens,
     * not after being charged.
     */
    validateCheckoutStock: build.mutation<StockValidation, void>({
      query: () => ({ url: '/checkout/validate-checkout-stock' })
    }),

    applyCoupon: build.mutation<{ success: boolean; message?: string }, string>({
      query: (couponCode) => ({
        url: '/checkout/apply-coupon',
        method: 'POST',
        data: { couponCode }
      }),
      invalidatesTags: ['Cart', 'Coupon']
    }),

    removeCoupon: build.mutation<{ success: boolean; message?: string }, void>({
      query: () => ({ url: '/checkout/remove-coupon', method: 'POST' }),
      invalidatesTags: ['Cart', 'Coupon']
    }),

    /** COD and wallet only - card payments go through the Razorpay pair below. */
    placeOrder: build.mutation<OrderResult, PlaceOrderArgs>({
      query: (body) => ({ url: '/checkout/place-order', method: 'POST', data: body }),
      invalidatesTags: [...AFTER_ORDER]
    }),

    /**
     * Creates the Razorpay order and the server-side snapshot of what is being
     * paid for. Nothing is charged yet, and no order row exists until verify.
     */
    createRazorpayOrder: build.mutation<
      RazorpayOrderResult,
      { deliveryAddressId: string; addressIndex: number }
    >({
      query: (body) => ({ url: '/checkout/create-razorpay-order', method: 'POST', data: body })
    }),

    /**
     * Confirms the payment. The server verifies the signature, finds its
     * snapshot by the Razorpay order id, and only then writes the order.
     */
    verifyRazorpayPayment: build.mutation<
      OrderResult,
      { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
    >({
      query: (body) => ({ url: '/checkout/verify-razorpay-payment', method: 'POST', data: body }),
      invalidatesTags: [...AFTER_ORDER]
    }),

    /** Records a dismissed or failed payment so the retry page has something to show. */
    reportPaymentFailure: build.mutation<
      OrderResult,
      { razorpayOrderId: string; error?: unknown }
    >({
      query: (body) => ({ url: '/checkout/payment-failure', method: 'POST', data: body }),
      invalidatesTags: [...AFTER_ORDER]
    }),

    payFromWallet: build.mutation<OrderResult, PlaceOrderArgs>({
      query: (body) => ({
        url: '/checkout/process-wallet-payment',
        method: 'POST',
        data: body
      }),
      invalidatesTags: [...AFTER_ORDER]
    })
  })
});

export const {
  useGetCheckoutQuery,
  useValidateCheckoutStockMutation,
  useApplyCouponMutation,
  useRemoveCouponMutation,
  usePlaceOrderMutation,
  useCreateRazorpayOrderMutation,
  useVerifyRazorpayPaymentMutation,
  useReportPaymentFailureMutation,
  usePayFromWalletMutation
} = checkoutApi;
