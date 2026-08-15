import { useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  useGetBestSellingBrandsQuery,
  useGetBestSellingCategoriesQuery,
  useGetBestSellingProductsQuery,
  useGetDashboardSalesQuery,
  useGetDashboardStatsQuery,
  useGetRevenueDistributionQuery,
  type Period,
  type RankedItem
} from './reports.api';
import EmptyState from '@/components/EmptyState';
import QueryBoundary from '@/components/QueryBoundary';
import { Skeleton } from '@/components/Skeleton';
import { formatINR, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

/**
 * The dashboard.
 *
 * 1,873 lines in EJS, 851 of them script, and none of the data came from the
 * server render - the page was already fully client-fetched from eight
 * endpoints. So this is the same eight requests with the imperative Chart.js
 * wiring replaced by components.
 *
 * Chart.js became Recharts: it takes data as props and re-renders, where
 * Chart.js needed instances created, destroyed and recreated by hand - which
 * is what most of those 851 lines were doing.
 */

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 'weekly', label: 'Last 12 weeks' },
  { value: 'monthly', label: 'Last 12 months' },
  { value: 'yearly', label: 'Last 5 years' }
];

/** Brand first, then the badge tones - distinguishable without being loud. */
const SLICE_COLOURS = ['#E03A2F', '#0d6efd', '#198754', '#6f42c1', '#ffc107', '#0dcaf0'];

const StatCard = ({
  label,
  value,
  loading
}: {
  label: string;
  value: string;
  loading: boolean;
}) => (
  <div className="rounded-lg border border-line bg-white p-5">
    <p className="text-sm text-ink-muted">{label}</p>
    {loading ? (
      <Skeleton className="mt-2 h-8 w-24" />
    ) : (
      <p className="mt-1 font-heading text-2xl font-semibold text-ink">{value}</p>
    )}
  </div>
);

const RankedList = ({
  title,
  items,
  isLoading,
  error,
  onRetry
}: {
  title: string;
  items: RankedItem[];
  isLoading: boolean;
  error?: unknown;
  onRetry: () => void;
}) => (
  <section className="rounded-lg border border-line bg-white p-5">
    <h2 className="mb-3 font-heading text-lg font-semibold text-ink">{title}</h2>

    <QueryBoundary
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      skeleton={
        <div className="space-y-2">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-8 w-full" />
          ))}
        </div>
      }
      empty={<EmptyState title="Nothing sold in this period" className="py-8" />}
      onRetry={onRetry}
    >
      <ol className="space-y-2">
        {items.slice(0, 5).map((item, index) => (
          <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="w-4 shrink-0 text-ink-muted">{index + 1}</span>
              <span className="truncate text-ink">{item.label}</span>
            </span>
            <span className="shrink-0 text-ink-muted">
              {formatNumber(item.quantity)} sold
            </span>
          </li>
        ))}
      </ol>
    </QueryBoundary>
  </section>
);

const DashboardPage = () => {
  const [period, setPeriod] = useState<Period>('monthly');

  const stats = useGetDashboardStatsQuery(period);
  const sales = useGetDashboardSalesQuery(period);
  const revenue = useGetRevenueDistributionQuery(period);
  const products = useGetBestSellingProductsQuery(period);
  const categories = useGetBestSellingCategoriesQuery(period);
  const brands = useGetBestSellingBrandsQuery(period);

  // Both already normalised in reports.api - see the note there about the
  // shapes these endpoints actually return.
  const salesData = sales.data ?? [];
  const distribution = revenue.data ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-semibold text-ink">Dashboard</h1>

        <div className="flex gap-1 rounded-md border border-line bg-white p-1">
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setPeriod(option.value)}
              aria-pressed={period === option.value}
              className={cn(
                'rounded px-3 py-1.5 text-sm transition-colors',
                period === option.value ? 'bg-ink text-white' : 'text-ink hover:bg-card'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatINR(Number(stats.data?.totalRevenue ?? 0))}
          loading={stats.isLoading}
        />
        <StatCard
          label="Orders"
          value={formatNumber(Number(stats.data?.totalOrders ?? 0))}
          loading={stats.isLoading}
        />
        <StatCard
          label="Customers"
          value={formatNumber(Number(stats.data?.totalCustomers ?? 0))}
          loading={stats.isLoading}
        />
        <StatCard
          label="Pending orders"
          value={formatNumber(Number(stats.data?.pendingOrders ?? 0))}
          loading={stats.isLoading}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border border-line bg-white p-5 lg:col-span-2">
          <h2 className="mb-4 font-heading text-lg font-semibold text-ink">Revenue over time</h2>

          <QueryBoundary
            isLoading={sales.isLoading}
            error={sales.error}
            isEmpty={salesData.length === 0}
            skeleton={<Skeleton className="h-64 w-full" />}
            empty={<EmptyState title="No sales in this period" className="py-12" />}
            onRetry={sales.refetch}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E03A2F" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#E03A2F" stopOpacity={0} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#D1D1D1" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#555555" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#555555"
                  // Full rupee amounts would push the axis half across the chart.
                  tickFormatter={(value: number) =>
                    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
                  }
                />
                <Tooltip
                  formatter={(value) => formatINR(Number(value ?? 0))}
                  contentStyle={{ borderRadius: 8, border: '1px solid #D1D1D1' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#E03A2F"
                  strokeWidth={2}
                  fill="url(#revenueFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </QueryBoundary>
        </section>

        <section className="rounded-lg border border-line bg-white p-5">
          <h2 className="mb-4 font-heading text-lg font-semibold text-ink">Revenue split</h2>

          <QueryBoundary
            isLoading={revenue.isLoading}
            error={revenue.error}
            isEmpty={distribution.length === 0}
            skeleton={<Skeleton className="h-64 w-full" />}
            empty={<EmptyState title="Nothing to split yet" className="py-12" />}
            onRetry={revenue.refetch}
          >
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {distribution.map((_, index) => (
                    <Cell key={index} fill={SLICE_COLOURS[index % SLICE_COLOURS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatINR(Number(value ?? 0))} />
              </PieChart>
            </ResponsiveContainer>

            <ul className="mt-3 space-y-1.5">
              {distribution.slice(0, 6).map((slice, index) => (
                <li key={slice.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SLICE_COLOURS[index % SLICE_COLOURS.length] }}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">{slice.name}</span>
                  <span className="text-ink-muted">{formatINR(slice.value)}</span>
                </li>
              ))}
            </ul>
          </QueryBoundary>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <RankedList
          title="Best selling products"
          items={products.data ?? []}
          isLoading={products.isLoading}
          error={products.error}
          onRetry={products.refetch}
        />
        <RankedList
          title="Best selling categories"
          items={categories.data ?? []}
          isLoading={categories.isLoading}
          error={categories.error}
          onRetry={categories.refetch}
        />
        <RankedList
          title="Best selling brands"
          items={brands.data ?? []}
          isLoading={brands.isLoading}
          error={brands.error}
          onRetry={brands.refetch}
        />
      </div>
    </div>
  );
};

export default DashboardPage;
