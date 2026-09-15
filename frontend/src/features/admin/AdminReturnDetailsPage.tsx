import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { useGetAdminReturnQuery, type AdminReturnDetails } from './adminOps.api';
import { useReturnDecision } from './useReturnDecision';
import Badge, {
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  RETURN_STATUS_TONE,
  paymentMethodTone,
  type Tone
} from '@/components/Badge';
import Button from '@/components/Button';
import PageHeader, { HeaderAction } from '@/components/PageHeader';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { usePageCrumb } from '@/components/layout/crumbLabel';
import { formatDate, formatDateTime, formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';
import {
  RETURN_STATUS,
  type OrderStatus,
  type PaymentStatus,
  type ReturnStatus
} from '@/types/domain';

/**
 * Admin return details.
 *
 * Laid out like the order details page beside it: the id and the date on the
 * header bar, the status next to the controls that change it, and the record
 * underneath. A return is a single item, so where the order page lists items
 * this shows the one - then who asked, the order it came from, and its history
 * where there is any.
 *
 * The decision is the one the list offers, asked the same way through
 * `useReturnDecision`. Once made it cannot be reversed from the admin, so a
 * decided return says what was decided instead of showing buttons that would
 * only fail.
 */

const REFUND_STATUS_TONE: Record<string, Tone> = {
  Pending: 'warning',
  Processed: 'success',
  Failed: 'danger'
};

const DETAILS = 'grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 p-5 text-sm';

const Card = ({
  title,
  className,
  children
}: {
  title: string;
  className?: string;
  children: ReactNode;
}) => (
  <section className={cn('rounded-lg border border-line bg-white', className)}>
    <h2 className="border-b border-line px-5 py-4 font-heading text-lg font-semibold text-ink">
      {title}
    </h2>
    {children}
  </section>
);

const Detail = ({ label, children }: { label: string; children: ReactNode }) => (
  <>
    <dt className="text-ink-muted">{label}</dt>
    <dd className="min-w-0 break-words text-ink">{children}</dd>
  </>
);

/** What a decided return says in place of the decision buttons. */
const decisionNote = (request: AdminReturnDetails['return'], refund: number): string => {
  switch (request.status) {
    case RETURN_STATUS.APPROVED:
      return `Approved${request.approvedAt ? ` on ${formatDate(request.approvedAt)}` : ''}. ${formatINR(refund)} was refunded${request.refundMethod === 'Wallet' ? " to the shopper's wallet" : ''}.`;
    case RETURN_STATUS.REJECTED:
      return `Rejected${request.rejectedAt ? ` on ${formatDate(request.rejectedAt)}` : ''}. The shopper was told: “${request.rejectionReason ?? 'No reason recorded'}”`;
    default:
      return `This return is ${request.status}, so there is no decision left to make.`;
  }
};

const AdminReturnDetailsPage = () => {
  const { returnId = '' } = useParams<{ returnId: string }>();
  const { data, isLoading, error, refetch } = useGetAdminReturnQuery(returnId, { skip: !returnId });
  const { approve, reject, isDeciding } = useReturnDecision();

  // The id is in the URL, so the trail can name the return before it loads.
  usePageCrumb(returnId || undefined);

  const request = data?.return;
  const order = data?.order;

  const pending = request?.status === RETURN_STATUS.PENDING;
  const refund = Number(request?.refundAmount ?? request?.totalPrice ?? 0);
  const image = request?.productImage ?? request?.productId?.mainImage;
  const customer = request?.userId;
  const history = request?.statusHistory ?? [];

  return (
    <>
      <PageHeader
        title={`Return #${request?.returnId ?? returnId}`}
        subtitle={
          request && (
            <>
              <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
              Requested on {formatDate(request.requestDate ?? request.createdAt, 'full')}
            </>
          )
        }
        actions={
          <HeaderAction to="/admin/returns" icon={<ArrowLeft className="size-4" aria-hidden="true" />}>
            Back to Returns
          </HeaderAction>
        }
      />

      {/* Only the detail is held to a readable width; the bar spans the column. */}
      <div className="max-w-4xl">
        <QueryBoundary
          isLoading={isLoading}
          error={error}
          skeleton={<SkeletonText lines={10} />}
          onRetry={refetch}
        >
          {request && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge tone={RETURN_STATUS_TONE[request.status as ReturnStatus] ?? 'secondary'}>
                  {request.status}
                </Badge>
                {/* A pending return's refund is pending by definition. */}
                {!pending && request.refundStatus && (
                  <Badge tone={REFUND_STATUS_TONE[request.refundStatus] ?? 'secondary'}>
                    Refund {request.refundStatus}
                  </Badge>
                )}
              </div>

              <div className="mt-6">
                {pending ? (
                  <div className="flex flex-wrap gap-3">
                    <Button disabled={isDeciding} onClick={() => approve(request)}>
                      Approve return
                    </Button>
                    <Button variant="outline" disabled={isDeciding} onClick={() => reject(request)}>
                      Reject return
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md bg-info/10 px-4 py-3 text-sm text-ink">
                    {decisionNote(request, refund)}
                  </p>
                )}
              </div>

              <Card title="Item" className="mt-8">
                <div className="flex flex-wrap items-center gap-4 p-5">
                  {image && (
                    <img
                      src={image}
                      alt=""
                      className="size-16 shrink-0 rounded-md border border-line object-cover"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    {request.productId?._id ? (
                      <Link
                        to={`/admin/products/${request.productId._id}`}
                        className="block truncate font-medium text-ink hover:text-brand"
                      >
                        {request.productName}
                      </Link>
                    ) : (
                      <p className="truncate font-medium text-ink">{request.productName}</p>
                    )}
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {request.size ? `Size ${request.size} · ` : ''}Qty {request.quantity ?? 1}
                      {request.sku && (
                        <>
                          {' · '}
                          <span className="font-mono text-xs">{request.sku}</span>
                        </>
                      )}
                    </p>
                  </div>

                  <p className="font-medium text-ink">{formatINR(Number(request.totalPrice ?? 0))}</p>
                </div>
              </Card>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <Card title="Return">
                  <dl className={DETAILS}>
                    <Detail label="Reason">{request.reason ?? '—'}</Detail>
                    {request.status !== RETURN_STATUS.REJECTED && (
                      <Detail label={pending ? 'Refund due' : 'Refunded'}>{formatINR(refund)}</Detail>
                    )}
                    {request.adminNotes && <Detail label="Notes">{request.adminNotes}</Detail>}
                  </dl>
                </Card>

                <Card title="Customer">
                  {customer ? (
                    <dl className={DETAILS}>
                      <Detail label="Name">{customer.name ?? '—'}</Detail>
                      <Detail label="Email">{customer.email ?? '—'}</Detail>
                      {customer.phone && <Detail label="Phone">{customer.phone}</Detail>}
                    </dl>
                  ) : (
                    <p className="p-5 text-sm text-ink-muted">
                      The account that asked for this return no longer exists.
                    </p>
                  )}
                </Card>
              </div>

              <Card title="Order" className="mt-6">
                {order ? (
                  <dl className={DETAILS}>
                    <Detail label="Order">
                      <Link to={`/admin/orders/${order.orderId}`} className="font-mono hover:text-brand">
                        {order.orderId}
                      </Link>
                    </Detail>
                    {order.createdAt && (
                      <Detail label="Placed">{formatDate(order.createdAt, 'full')}</Detail>
                    )}
                    <Detail label="Status">
                      <Badge size="sm" tone={ORDER_STATUS_TONE[order.status as OrderStatus] ?? 'secondary'}>
                        {order.status}
                      </Badge>
                    </Detail>
                    {(order.paymentStatus || order.paymentMethod) && (
                      <Detail label="Payment">
                        <span className="flex flex-wrap gap-1">
                          {order.paymentStatus && (
                            <Badge
                              size="sm"
                              tone={PAYMENT_STATUS_TONE[order.paymentStatus as PaymentStatus] ?? 'secondary'}
                            >
                              {order.paymentStatus}
                            </Badge>
                          )}
                          {order.paymentMethod && (
                            <Badge size="sm" tone={paymentMethodTone(order.paymentMethod)} uppercase>
                              {order.paymentMethod}
                            </Badge>
                          )}
                        </span>
                      </Detail>
                    )}
                  </dl>
                ) : (
                  <p className="p-5 text-sm text-ink-muted">
                    Order <span className="font-mono">{request.orderId}</span> no longer exists.
                  </p>
                )}
              </Card>

              {history.length > 0 && (
                <Card title="History" className="mt-6">
                  <ol className="divide-y divide-line">
                    {history.map((entry, index) => (
                      <li
                        key={entry._id ?? index}
                        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3 text-sm"
                      >
                        <Badge
                          size="sm"
                          tone={RETURN_STATUS_TONE[entry.status as ReturnStatus] ?? 'secondary'}
                        >
                          {entry.status}
                        </Badge>
                        <span className="text-ink-muted">{formatDateTime(entry.updatedAt)}</span>
                        {entry.notes && <span className="w-full text-ink">{entry.notes}</span>}
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </>
          )}
        </QueryBoundary>
      </div>
    </>
  );
};

export default AdminReturnDetailsPage;
