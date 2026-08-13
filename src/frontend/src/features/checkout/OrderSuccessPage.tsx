import { Link, useParams } from 'react-router-dom';
import { BsCheckCircleFill } from 'react-icons/bs';
import { api } from '@/api/api';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { formatINR } from '@/lib/format';

/**
 * Order placed.
 *
 * The EJS version was 702 lines, most of it a confetti animation and print
 * styles. What matters is the confirmation, what was bought, where it is
 * going, and a way to reach the order again.
 */

interface OrderSuccessData {
  orderId?: string;
  orderNumber?: string;
  items?: Array<{
    productName?: string;
    size?: string;
    quantity?: number;
    totalPrice?: number;
    price?: number;
  }>;
  deliveryAddress?: {
    name?: string;
    landMark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  };
  paymentMethod?: string;
  subtotal?: number;
  totalDiscount?: number;
  couponDiscount?: number;
  shipping?: number;
  total?: number;
  totalItemCount?: number;
}

const orderSuccessApi = api.injectEndpoints({
  endpoints: (build) => ({
    getOrderSuccess: build.query<OrderSuccessData, string>({
      query: (orderId) => ({ url: `/checkout/order-success/${orderId}` }),
      transformResponse: (response: { orderData?: OrderSuccessData }) => response.orderData ?? {}
    })
  })
});

const { useGetOrderSuccessQuery } = orderSuccessApi;

const OrderSuccessPage = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { data, isLoading, error, refetch } = useGetOrderSuccessQuery(orderId ?? '', {
    skip: !orderId
  });

  const address = data?.deliveryAddress;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="text-center">
        <BsCheckCircleFill className="mx-auto size-14 text-success" aria-hidden="true" />
        <h1 className="mt-4 font-heading text-3xl font-semibold text-ink">Order placed</h1>
        <p className="mt-2 text-ink-muted">
          Thanks — we&apos;ve got it. A confirmation is on its way to your email.
        </p>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={<SkeletonText lines={6} className="mt-10" />}
        onRetry={refetch}
      >
        <div className="mt-10 rounded-lg border border-line bg-white p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-4">
            <span className="text-sm text-ink-muted">Order number</span>
            <span className="font-mono font-medium text-ink">
              {data?.orderNumber ?? data?.orderId ?? orderId}
            </span>
          </div>

          {(data?.items?.length ?? 0) > 0 && (
            <ul className="divide-y divide-line">
              {data?.items?.map((item, index) => (
                <li key={index} className="flex justify-between gap-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{item.productName}</span>
                    <span className="text-sm text-ink-muted">
                      {item.size && `Size ${item.size} · `}Qty {item.quantity}
                    </span>
                  </span>
                  <span className="shrink-0 font-medium text-ink">
                    {formatINR(item.totalPrice ?? 0)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-between border-t border-line pt-4">
            <span className="font-medium text-ink">Total paid</span>
            <span className="font-semibold text-ink">{formatINR(data?.total ?? 0)}</span>
          </div>

          {address && (
            <div className="mt-6 border-t border-line pt-4">
              <h2 className="text-sm font-medium text-ink">Delivering to</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {address.name}
                <br />
                {address.landMark}, {address.city}, {address.state} — {address.pincode}
                <br />
                {address.phone}
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            to="/orders"
            className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
          >
            View your orders
          </Link>
          <Link
            to="/shop"
            className="rounded-md border border-line px-5 py-2.5 font-medium text-ink hover:bg-card"
          >
            Keep shopping
          </Link>
        </div>
      </QueryBoundary>
    </div>
  );
};

export default OrderSuccessPage;
