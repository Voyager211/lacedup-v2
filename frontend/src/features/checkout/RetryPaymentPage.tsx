import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/api/api';
import { useRazorpay } from './useRazorpay';
import Button from '@/components/Button';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { useToast } from '@/components/toast';
import { formatINR } from '@/lib/format';

/**
 * Retry a failed payment.
 *
 * Unlike first-time checkout, the order row already exists - this pays for it
 * rather than creating anything. The server marks its snapshot with
 * `retryOrderId` so verification updates that order instead of writing a new
 * one.
 */

interface RetryData {
  transactionId?: string;
  orderId?: string;
  orderNumber?: string;
  failureReason?: string;
  orderData?: { total?: number; totalItemCount?: number };
}

const retryApi = api.injectEndpoints({
  endpoints: (build) => ({
    getRetryPayment: build.query<RetryData, string>({
      query: (transactionId) => ({ url: `/checkout/retry-payment/${transactionId}` })
    }),

    createRetryOrder: build.mutation<
      { success: boolean; data: { razorpayOrderId: string; amount: number; currency: string; keyId: string } },
      string
    >({
      query: (transactionId) => ({
        url: '/checkout/create-razorpay-order-retry',
        method: 'POST',
        data: { transactionId }
      })
    }),

    verifyRetryPayment: build.mutation<
      { success: boolean; data?: { orderNumber?: string } },
      { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
    >({
      query: (body) => ({
        url: '/checkout/verify-retry-razorpay-payment',
        method: 'POST',
        data: body
      }),
      invalidatesTags: ['Order', 'Cart', 'CartCount', 'Wallet']
    }),

    reportRetryFailure: build.mutation<{ success: boolean }, { razorpayOrderId: string }>({
      query: (body) => ({ url: '/checkout/retry-payment-failure', method: 'POST', data: body })
    })
  })
});

const {
  useGetRetryPaymentQuery,
  useCreateRetryOrderMutation,
  useVerifyRetryPaymentMutation,
  useReportRetryFailureMutation
} = retryApi;

const RetryPaymentPage = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const openRazorpay = useRazorpay();

  const { data, isLoading, error, refetch } = useGetRetryPaymentQuery(transactionId ?? '', {
    skip: !transactionId
  });

  const [createRetryOrder] = useCreateRetryOrderMutation();
  const [verifyRetry] = useVerifyRetryPaymentMutation();
  const [reportRetryFailure] = useReportRetryFailureMutation();

  const [paying, setPaying] = useState(false);

  const pay = async () => {
    if (!transactionId || paying) return;

    setPaying(true);

    try {
      const created = await createRetryOrder(transactionId).unwrap();
      const { razorpayOrderId, amount, currency, keyId } = created.data;

      await openRazorpay({
        orderId: razorpayOrderId,
        amount,
        currency,
        keyId,

        onSuccess: async (response) => {
          try {
            await verifyRetry({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature
            }).unwrap();

            toast.success('Payment successful');
            navigate(`/checkout/order-success/${data?.orderNumber ?? ''}`);
          } catch {
            toast.error(
              'We could not confirm your payment',
              'If you were charged, your order will update shortly. Check your orders before paying again.'
            );
            navigate('/orders');
          } finally {
            setPaying(false);
          }
        },

        onDismiss: async (reason) => {
          setPaying(false);

          if (reason === 'unavailable') {
            toast.error('The payment window could not be opened');
            return;
          }

          await reportRetryFailure({ razorpayOrderId }).unwrap().catch(() => {});
          toast.info('Payment cancelled');
        }
      });
    } catch (caught) {
      setPaying(false);
      toast.fromError(caught, 'Could not start the payment.');
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="font-heading text-3xl font-semibold text-ink">Complete your payment</h1>
      <p className="mt-2 text-ink-muted">
        Your order is saved and waiting. Nothing has been charged yet.
      </p>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={<SkeletonText lines={4} className="mt-8" />}
        onRetry={refetch}
      >
        <div className="mt-8 space-y-3 rounded-lg border border-line bg-white p-6 text-sm">
          {data?.orderNumber && (
            <div className="flex justify-between">
              <span className="text-ink-muted">Order number</span>
              <span className="font-mono text-ink">{data.orderNumber}</span>
            </div>
          )}

          {data?.failureReason && (
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Last attempt</span>
              <span className="text-right text-ink">{data.failureReason}</span>
            </div>
          )}

          <div className="flex justify-between border-t border-line pt-3">
            <span className="font-medium text-ink">Amount due</span>
            <span className="font-semibold text-ink">
              {formatINR(data?.orderData?.total ?? 0)}
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" loading={paying} onClick={pay}>
            Pay {formatINR(data?.orderData?.total ?? 0)}
          </Button>
          <Link
            to="/orders"
            className="flex h-12 items-center rounded-md border border-line px-5 font-medium text-ink hover:bg-card"
          >
            Back to orders
          </Link>
        </div>
      </QueryBoundary>
    </div>
  );
};

export default RetryPaymentPage;
