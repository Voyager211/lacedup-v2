import { Link, useSearchParams } from 'react-router-dom';
import { useGetAdminOrdersQuery } from './adminOps.api';
import Badge, { ORDER_STATUS_TONE, PAYMENT_STATUS_TONE, paymentMethodTone } from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonTable } from '@/components/Skeleton';
import { formatDate, formatINR } from '@/lib/format';
import { ORDER_STATUS, PAYMENT_STATUS, type OrderStatus, type PaymentStatus } from '@/types/domain';
import { cn } from '@/lib/cn';
import { ROW_HOVER, RowNumber, RowNumberHeader } from '@/components/table';

/**
 * Admin orders.
 *
 * The list is item-level, not order-level: the server's aggregation unwinds
 * items, so an order with three lines appears as three rows and the status
 * filter matches an item's status rather than the order's. That is worth
 * knowing before reading the counts - it is why the row count and the order
 * count differ.
 */
const AdminOrdersPage = () => {
  const [params, setParams] = useSearchParams();

  const page = Number(params.get('page')) || 1;
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const paymentStatus = params.get('paymentStatus') ?? '';
  const sortBy = params.get('sortBy') ?? 'createdAt';

  const { data, isLoading, isFetching, error, refetch } = useGetAdminOrdersQuery({
    page,
    search,
    status,
    paymentStatus,
    sortBy
  });

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const rows = data?.orders ?? [];

  return (
    <div>
      <h1 className="mb-1 font-heading text-2xl font-semibold text-ink">Orders</h1>
      <p className="mb-5 text-sm text-ink-muted">
        One row per item — an order with several items appears more than once.
      </p>

      <FilterBar
        search={search}
        onSearchChange={(value) => setParam('search', value)}
        searchPlaceholder="Search by order id, customer, product or SKU…"
        filters={[
          {
            name: 'status',
            label: 'Item status',
            allLabel: 'All',
            options: Object.values(ORDER_STATUS).map((value) => ({ value, label: value }))
          },
          {
            name: 'paymentStatus',
            label: 'Payment',
            allLabel: 'All',
            options: Object.values(PAYMENT_STATUS).map((value) => ({ value, label: value }))
          },
          {
            name: 'sortBy',
            label: 'Sort',
            options: [
              { value: 'createdAt', label: 'Newest' },
              { value: 'totalAmount', label: 'Amount' },
              { value: 'status', label: 'Status' }
            ]
          }
        ]}
        values={{ status, paymentStatus, sortBy }}
        onFilterChange={setParam}
        onReset={() => setParams({})}
      />

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={rows.length === 0}
        skeleton={<SkeletonTable rows={8} columns={6} />}
        empty={<EmptyState title="No orders match that" />}
        onRetry={refetch}
      >
        <div className={cn('overflow-x-auto rounded-lg border border-line bg-white', isFetching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-card/50 text-left">
              <tr>
                <RowNumberHeader />
                <th className="px-4 py-3 font-medium text-ink">Order</th>
                <th className="px-4 py-3 font-medium text-ink">Customer</th>
                <th className="px-4 py-3 font-medium text-ink">Item</th>
                <th className="px-4 py-3 font-medium text-ink">Total</th>
                <th className="px-4 py-3 font-medium text-ink">Placed</th>
                <th className="px-4 py-3 font-medium text-ink">Status</th>
                <th className="px-4 py-3 font-medium text-ink">Payment</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {rows.map((row, index) => (
                <tr key={`${row._id}-${index}`} className={ROW_HOVER}>
                  <RowNumber index={index} page={data?.currentPage ?? 1} />

                  <td className="px-4 py-3">
                    <Link
                      to={`/admin/orders/${row.orderId}`}
                      className="font-mono text-ink hover:text-brand"
                    >
                      {row.orderId}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{row.customerName ?? '—'}</td>
                  <td className="max-w-xs px-4 py-3 text-ink">
                    <span className="line-clamp-1">{row.productName ?? '—'}</span>
                    {row.size && (
                      <span className="text-xs text-ink-muted">
                        Size {row.size} · Qty {row.quantity ?? 1}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink">{formatINR(Number(row.totalPrice ?? 0))}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatDate(row.orderDate ?? row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge size="sm" tone={ORDER_STATUS_TONE[row.status as OrderStatus] ?? 'secondary'}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {row.paymentStatus && (
                        <Badge
                          size="sm"
                          tone={PAYMENT_STATUS_TONE[row.paymentStatus as PaymentStatus] ?? 'secondary'}
                        >
                          {row.paymentStatus}
                        </Badge>
                      )}
                      {row.paymentMethod && (
                        <Badge size="sm" tone={paymentMethodTone(row.paymentMethod)} uppercase>
                          {row.paymentMethod}
                        </Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(data?.totalPages ?? 0) > 1 && (
          <Pagination
            className="mt-6"
            currentPage={data?.currentPage ?? 1}
            totalPages={data?.totalPages ?? 1}
            disabled={isFetching}
            onPageChange={(next) => setParam('page', String(next))}
          />
        )}
      </QueryBoundary>
    </div>
  );
};

export default AdminOrdersPage;
