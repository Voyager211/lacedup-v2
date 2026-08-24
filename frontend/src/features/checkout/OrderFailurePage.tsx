import { Link, useParams } from 'react-router-dom';
import { BsExclamationCircleFill } from 'react-icons/bs';
import { api } from '@/api/api';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { formatINR } from '@/lib/format';

/**
 * Payment failed.
 *
 * The order row exists with a failed payment status, so this page's job is to
 * say what happened and offer the retry - not to imply the basket is lost.
 */

interface FailureData {
  transactionId?: string;
  orderId?: string;
  orderNumber?: string;
  failureReason?: string;
  canRetry?: boolean;
  orderData?: { total?: number; totalItemCount?: number };
}

const failureApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOrderFailure: build.query<FailureData, string>({
      query: (transactionId) => ({ url: `/checkout/order-failure/${transactionId}` })
    })
  })
});

const { useGetOrderFailureQuery } = failureApi;

const OrderFailurePage = () => {
  const { transactionId } = useParams<{ transactionId: string }>();
  const { data, isLoading, error, refetch } = useGetOrderFailureQuery(transactionId ?? '', {
    skip: !transactionId
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <BsExclamationCircleFill className="mx-auto size-14 text-danger" aria-hidden="true" />
        <h1 className="mt-4 font-heading text-3xl font-semibold text-ink">Payment didn&apos;t go through</h1>
        <p className="mt-2 text-ink-muted">
          Nothing has been charged. Your order is saved, so you can try again.
        </p>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={<SkeletonText lines={4} className="mt-10" />}
        onRetry={refetch}
      >
        <div className="mt-10 space-y-3 rounded-lg border border-line bg-white p-6 text-sm">
          {data?.orderNumber && (
            <div className="flex justify-between">
              <span className="text-ink-muted">Order number</span>
              <span className="font-mono text-ink">{data.orderNumber}</span>
            </div>
          )}

          {data?.failureReason && (
            <div className="flex justify-between gap-4">
              <span className="text-ink-muted">Reason</span>
              <span className="text-right text-ink">{data.failureReason}</span>
            </div>
          )}

          {data?.orderData?.total !== undefined && (
            <div className="flex justify-between border-t border-line pt-3">
              <span className="font-medium text-ink">Amount due</span>
              <span className="font-semibold text-ink">{formatINR(data.orderData.total)}</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {data?.canRetry !== false && transactionId && (
            <Link
              to={`/checkout/retry-payment/${transactionId}`}
              className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
            >
              Try paying again
            </Link>
          )}
          <Link
            to="/orders"
            className="rounded-md border border-line px-5 py-2.5 font-medium text-ink hover:bg-card"
          >
            View your orders
          </Link>
        </div>
      </QueryBoundary>
    </div>
  );
};

export default OrderFailurePage;
