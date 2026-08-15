import { useSearchParams } from 'react-router-dom';
import { FileText, Sheet } from 'lucide-react';
import { useGetSalesReportQuery } from './reports.api';
import Badge, { ORDER_STATUS_TONE, paymentMethodTone } from '@/components/Badge';
import EmptyState from '@/components/EmptyState';
import PageHeader, { HeaderAction } from '@/components/PageHeader';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonTable } from '@/components/Skeleton';
import { SelectField, TextField } from '@/components/form/TextField';
import { formatDate, formatINR, formatNumber } from '@/lib/format';
import { ORDER_STATUS, PAYMENT_METHODS, type OrderStatus } from '@/types/domain';
import { cn } from '@/lib/cn';
import { ROW_HOVER_STATIC, RowNumber, RowNumberHeader } from '@/components/table';

/**
 * The sales report.
 *
 * This is the page that had no JSON endpoint: it refreshed by refetching its
 * own HTML with an X-Requested-With header, parsing the response with
 * DOMParser and swapping four regions into place - against a controller that
 * had no branch for that header, so it returned the whole page, layout
 * included, every time. One was added in step 11.
 *
 * The exports stay as they were: both are generated server-side with pdfkit
 * and exceljs, so they are plain links carrying the current filters.
 */

const TIME_PERIODS = [
  { value: 'weekly', label: 'Last 7 days' },
  { value: 'monthly', label: 'Last 30 days' },
  { value: 'yearly', label: 'Last year' },
  { value: 'custom', label: 'Custom range' }
];

const SalesReportPage = () => {
  const [params, setParams] = useSearchParams();

  const filters = {
    page: Number(params.get('page')) || 1,
    timePeriod: params.get('timePeriod') ?? 'monthly',
    paymentMethod: params.get('paymentMethod') ?? 'all',
    orderStatus: params.get('orderStatus') ?? 'all',
    startDate: params.get('startDate') ?? '',
    endDate: params.get('endDate') ?? ''
  };

  const { data, isLoading, isFetching, error, refetch } = useGetSalesReportQuery(filters);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  /** The export routes take the same query string the report does. */
  const exportQuery = new URLSearchParams(
    Object.entries(filters)
      .filter(([key, value]) => key !== 'page' && value !== '' && value != null)
      .map(([key, value]) => [key, String(value)])
  ).toString();

  const stats = data?.salesStats;
  const orders = data?.orders ?? [];

  return (
    <div>
      <PageHeader
        title="Sales Report"
        subtitle="Comprehensive sales analytics and performance insights"
        actions={
          <>
            <HeaderAction
              icon={<FileText className="size-4" aria-hidden="true" />}
              onClick={() =>
                window.open(`/api/admin/sales-report/export-pdf?${exportQuery}`, '_blank')
              }
            >
              Export PDF
            </HeaderAction>

            <HeaderAction
              tone="success"
              icon={<Sheet className="size-4" aria-hidden="true" />}
              onClick={() =>
                window.open(`/api/admin/sales-report/export-excel?${exportQuery}`, '_blank')
              }
            >
              Export Excel
            </HeaderAction>
          </>
        }
      />

      <div className="mb-5 grid gap-3 rounded-lg border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Period"
          options={TIME_PERIODS}
          value={filters.timePeriod}
          onChange={(event) => setParam('timePeriod', event.target.value)}
        />

        <SelectField
          label="Payment method"
          options={[
            { value: 'all', label: 'All' },
            ...Object.values(PAYMENT_METHODS).map((value) => ({ value, label: value }))
          ]}
          value={filters.paymentMethod}
          onChange={(event) => setParam('paymentMethod', event.target.value)}
        />

        <SelectField
          label="Order status"
          options={[
            { value: 'all', label: 'All' },
            ...Object.values(ORDER_STATUS).map((value) => ({ value, label: value }))
          ]}
          value={filters.orderStatus}
          onChange={(event) => setParam('orderStatus', event.target.value)}
        />

        {filters.timePeriod === 'custom' && (
          <>
            <TextField
              label="From"
              type="date"
              value={filters.startDate}
              onChange={(event) => setParam('startDate', event.target.value)}
            />
            <TextField
              label="To"
              type="date"
              value={filters.endDate}
              onChange={(event) => setParam('endDate', event.target.value)}
            />
          </>
        )}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Revenue', value: formatINR(stats?.totalRevenue ?? 0) },
          { label: 'Orders', value: formatNumber(stats?.totalOrders ?? 0) },
          { label: 'Average order', value: formatINR(stats?.averageOrder ?? 0) },
          { label: 'Discounts', value: formatINR(stats?.totalDiscount ?? 0) },
          { label: 'Net revenue', value: formatINR(stats?.netRevenue ?? 0) }
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line bg-white p-4">
            <p className="text-sm text-ink-muted">{stat.label}</p>
            <p className="mt-1 font-heading text-xl font-semibold text-ink">{stat.value}</p>
          </div>
        ))}
      </div>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={orders.length === 0}
        skeleton={<SkeletonTable rows={8} columns={6} />}
        empty={<EmptyState title="No orders in this period" message="Try a wider date range." />}
        onRetry={refetch}
      >
        <div className={cn('overflow-x-auto rounded-lg border border-line bg-white', isFetching && 'opacity-60')}>
          <table className="w-full text-sm">
            <thead className="border-b border-line bg-card/50 text-left">
              <tr>
                <RowNumberHeader />
                <th className="px-4 py-3 font-medium text-ink">Order</th>
                <th className="px-4 py-3 font-medium text-ink">Date</th>
                <th className="px-4 py-3 font-medium text-ink">Customer</th>
                <th className="px-4 py-3 font-medium text-ink">Status</th>
                <th className="px-4 py-3 font-medium text-ink">Payment</th>
                <th className="px-4 py-3 text-right font-medium text-ink">Amount</th>
                <th className="px-4 py-3 text-right font-medium text-ink">Discount</th>
                <th className="px-4 py-3 text-right font-medium text-ink">Net</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-line">
              {orders.map((order, index) => (
                <tr key={order._id} className={ROW_HOVER_STATIC}>
                  <RowNumber index={index} page={data?.pagination.currentPage ?? 1} />
                  <td className="px-4 py-3 font-mono text-ink">{order.orderId}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {/* The raw createdAt, so this date reads like every other
                        date in the app rather than the server's own format. */}
                    {order.createdAt ? formatDate(order.createdAt) : order.date}
                  </td>
                  <td className="px-4 py-3 text-ink">{order.customer}</td>
                  <td className="px-4 py-3">
                    <Badge size="sm" tone={ORDER_STATUS_TONE[order.status as OrderStatus] ?? 'secondary'}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge size="sm" tone={paymentMethodTone(order.paymentMethod)} uppercase>
                      {order.paymentMethod}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right text-ink">{formatINR(order.amount)}</td>
                  <td className="px-4 py-3 text-right text-success">
                    {order.discount > 0 ? `−${formatINR(order.discount)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-ink">
                    {formatINR(order.finalAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(data?.pagination.totalPages ?? 0) > 1 && (
          <Pagination
            className="mt-6"
            currentPage={data?.pagination.currentPage ?? 1}
            totalPages={data?.pagination.totalPages ?? 1}
            disabled={isFetching}
            onPageChange={(next) => setParam('page', String(next))}
          />
        )}
      </QueryBoundary>
    </div>
  );
};

export default SalesReportPage;
