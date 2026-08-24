import { Link, useParams } from 'react-router-dom';
import { BsDownload } from 'react-icons/bs';
import { useGetOrderQuery, type OrderItem } from './orders.api';
import { useOrderActions } from './useOrderActions';
import Badge, { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, paymentMethodTone } from '@/components/Badge';
import Button from '@/components/Button';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { ORDER_STATUS, type OrderStatus, type PaymentStatus } from '@/types/domain';
import { usePageCrumb } from '@/components/layout/crumbLabel';

/**
 * A single order.
 *
 * Which actions are offered follows the same rules the server enforces: an
 * order can only be cancelled while Pending or Processing, and only returned
 * once Delivered. Offering a button the server will refuse is worse than not
 * offering it, so the checks are mirrored here - the server still decides.
 */

/** Items in these states are done with; nothing can be actioned on them. */
const SETTLED_ITEM_STATES = ['Cancelled', 'Returned', 'Processing Return'];

const CANCELLABLE_ORDER_STATES: string[] = [ORDER_STATUS.PENDING, ORDER_STATUS.PROCESSING];
const RETURNABLE_ORDER_STATES: string[] = [
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.PARTIALLY_DELIVERED
];

const ItemRow = ({
  item,
  canCancel,
  canReturn,
  onCancel,
  onReturn
}: {
  item: OrderItem;
  canCancel: boolean;
  canReturn: boolean;
  onCancel: () => void;
  onReturn: () => void;
}) => {
  const settled = SETTLED_ITEM_STATES.includes(item.status ?? '');

  return (
    <li className="flex gap-4 border-b border-line py-4 last:border-0">
      <Link to={`/product/${item.productId?.slug ?? ''}`} className="shrink-0">
        <img
          src={item.productId?.mainImage}
          alt=""
          loading="lazy"
          className="size-20 rounded-md object-cover"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">
              {item.productId?.productName ?? item.productName}
            </p>
            <p className="mt-0.5 text-sm text-ink-muted">
              {item.size && `Size ${item.size} · `}Qty {item.quantity}
            </p>

            {item.status && (
              <Badge
                className="mt-2"
                size="sm"
                tone={ORDER_STATUS_TONE[item.status as OrderStatus] ?? 'secondary'}
              >
                {item.status}
              </Badge>
            )}

            {item.cancellationReason && (
              <p className="mt-1 text-sm text-ink-muted">Reason: {item.cancellationReason}</p>
            )}
            {item.returnReason && (
              <p className="mt-1 text-sm text-ink-muted">Return reason: {item.returnReason}</p>
            )}
          </div>

          <p className="shrink-0 font-medium text-ink">{formatINR(item.totalPrice)}</p>
        </div>

        {!settled && (canCancel || canReturn) && (
          <div className="mt-3 flex gap-3">
            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="text-sm text-ink-muted hover:text-danger"
              >
                Cancel this item
              </button>
            )}
            {canReturn && (
              <button
                type="button"
                onClick={onReturn}
                className="text-sm text-ink-muted hover:text-brand"
              >
                Return this item
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
};

const OrderDetailsPage = () => {
  const { orderId = '' } = useParams<{ orderId: string }>();
  const { data, isLoading, error, refetch } = useGetOrderQuery(orderId, { skip: !orderId });

  // The id is in the URL, so the trail can name the order before it loads.
  usePageCrumb(orderId || undefined);

  const actions = useOrderActions({
    cancellation: data?.cancellationReasons ?? [],
    return: data?.returnReasons ?? []
  });

  const order = data?.order;
  const canCancel = CANCELLABLE_ORDER_STATES.includes(order?.status ?? '');
  const canReturn = RETURNABLE_ORDER_STATES.includes(order?.status ?? '');
  const address = order?.deliveryAddress as Record<string, string> | undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={<SkeletonText lines={8} />}
        onRetry={refetch}
      >
        {order && (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl font-semibold text-ink">
                  Order {order.orderId}
                </h1>
                <p className="mt-1 text-sm text-ink-muted">
                  Placed {formatDateTime(order.createdAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge tone={ORDER_STATUS_TONE[order.status as OrderStatus] ?? 'secondary'}>
                  {order.status}
                </Badge>
                {order.paymentStatus && (
                  <Badge
                    tone={PAYMENT_STATUS_TONE[order.paymentStatus as PaymentStatus] ?? 'secondary'}
                  >
                    {order.paymentStatus}
                  </Badge>
                )}
                {order.paymentMethod && (
                  <Badge tone={paymentMethodTone(order.paymentMethod)} uppercase>
                    {order.paymentMethod}
                  </Badge>
                )}
              </div>
            </header>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                size="sm"
                variant="outline"
                icon={<BsDownload className="size-4" aria-hidden="true" />}
                onClick={() => actions.downloadInvoice(order.orderId)}
              >
                Invoice
              </Button>

              {canCancel && (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => actions.cancelWholeOrder(order.orderId)}
                >
                  Cancel order
                </Button>
              )}

              {canReturn && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => actions.returnWholeOrder(order.orderId)}
                >
                  Return order
                </Button>
              )}
            </div>

            {/*
              The server refuses order-level transitions on partial states and
              returns an empty list of them, which in the admin UI shows as an
              empty dropdown with no explanation. Saying so is better than
              leaving someone to guess.
            */}
            {(order.status === ORDER_STATUS.PARTIALLY_DELIVERED ||
              order.status === ORDER_STATUS.PARTIALLY_RETURNED) && (
              <p className="mt-4 rounded-md bg-info/10 px-4 py-3 text-sm text-ink">
                Some items in this order are at a different stage from the rest, so actions are
                per item rather than for the whole order.
              </p>
            )}

            <section className="mt-8 rounded-lg border border-line bg-white p-5">
              <h2 className="font-heading text-lg font-semibold text-ink">Items</h2>

              <ul className="mt-2">
                {order.items?.map((item) => (
                  <ItemRow
                    key={item._id}
                    item={item}
                    canCancel={canCancel}
                    canReturn={canReturn}
                    onCancel={() => actions.cancelOneItem(order.orderId, item._id)}
                    onReturn={() => actions.returnOneItem(order.orderId, item._id)}
                  />
                ))}
              </ul>
            </section>

            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              <section className="rounded-lg border border-line bg-white p-5">
                <h2 className="font-heading text-lg font-semibold text-ink">Payment</h2>

                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Subtotal</dt>
                    <dd className="text-ink">{formatINR(order.subtotal ?? 0)}</dd>
                  </div>

                  {(order.totalDiscount ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">Offers</dt>
                      <dd className="text-success">−{formatINR(order.totalDiscount ?? 0)}</dd>
                    </div>
                  )}

                  {(order.couponDiscount ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <dt className="text-ink-muted">Coupon</dt>
                      <dd className="text-success">−{formatINR(order.couponDiscount ?? 0)}</dd>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <dt className="text-ink-muted">Delivery</dt>
                    <dd className="text-ink">
                      {(order.shipping ?? 0) === 0 ? 'Free' : formatINR(order.shipping ?? 0)}
                    </dd>
                  </div>

                  <div className="flex justify-between border-t border-line pt-2">
                    <dt className="font-medium text-ink">Total</dt>
                    <dd className="font-semibold text-ink">
                      {formatINR(order.finalAmount ?? order.totalAmount ?? 0)}
                    </dd>
                  </div>
                </dl>
              </section>

              {address && (
                <section className="rounded-lg border border-line bg-white p-5">
                  <h2 className="font-heading text-lg font-semibold text-ink">Delivery address</h2>
                  <p className="mt-3 text-sm text-ink-muted">
                    {address.name}
                    <br />
                    {address.landMark}, {address.city}
                    <br />
                    {address.state} — {address.pincode}
                    <br />
                    {address.phone}
                  </p>
                </section>
              )}
            </div>

            {(order.comprehensiveStatusHistory?.length ?? 0) > 0 && (
              <section className="mt-6 rounded-lg border border-line bg-white p-5">
                <h2 className="font-heading text-lg font-semibold text-ink">History</h2>

                <ol className="mt-4 space-y-4">
                  {order.comprehensiveStatusHistory?.map((entry, index) => (
                    <li key={index} className="flex gap-3">
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-brand"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="block font-medium text-ink">{entry.status}</span>
                        {entry.date && (
                          <span className="block text-sm text-ink-muted">
                            {formatDate(entry.date)}
                          </span>
                        )}
                        {entry.note && (
                          <span className="block text-sm text-ink-muted">{entry.note}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

export default OrderDetailsPage;
