import { api } from '@/api/api';

/**
 * Dashboard and sales report.
 *
 * The dashboard is six endpoints keyed on the same `period`. They stayed
 * separate rather than being combined server-side because each is
 * independently cacheable and the page can render whichever arrive first.
 *
 * Every one of them returns `{ success, data }`, but `data` is shaped
 * differently in each and none of it matches what a chart wants:
 *
 *   stats                 { totalCustomers, totalOrders, totalRevenue, pendingOrders }
 *   sales                 { labels: string[], salesData: number[] }   <- two parallel arrays
 *   revenue-distribution  [{ paymentMethod, revenue, percentage }]
 *   best-selling-*        [{ productName | categoryName | brandName, totalQuantity, totalRevenue }]
 *
 * So the normalising happens here, in transformResponse, and the components
 * receive arrays they can render directly. Doing it in the component is what
 * produced the crash this file was rewritten to fix: `sales.data` is an object,
 * and `.map` on it threw before the page could paint.
 */

export type Period = 'weekly' | 'monthly' | 'yearly';

export interface DashboardStats {
  totalCustomers: number;
  totalOrders: number;
  totalRevenue: number;
  /** Orders still Pending or Processing. There is no product count. */
  pendingOrders: number;
}

/** One point on the revenue chart. */
export interface SalesPoint {
  label: string;
  revenue: number;
}

/** A slice of the payment-method split. */
export interface RevenueSlice {
  name: string;
  value: number;
  percentage: number;
}

/** A row in one of the three "best selling" lists. */
export interface RankedItem {
  id: string;
  label: string;
  /** Units sold. The API calls this totalQuantity. */
  quantity: number;
  revenue: number;
}

export interface SalesReport {
  salesStats: {
    totalRevenue: number;
    totalOrders: number;
    averageOrder: number;
    totalDiscount: number;
    netRevenue: number;
  };
  dailyAnalysis: Array<{
    date: string;
    orders: number;
    revenue: number;
    discount: number;
    netRevenue: number;
  }>;
  orders: Array<{
    _id: string;
    orderId: string;
    createdAt?: string;
    date: string;
    customer: string;
    paymentMethod: string;
    status: string;
    amount: number;
    discount: number;
    finalAmount: number;
  }>;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalOrders: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
}

export interface ReportFilters {
  page?: number;
  timePeriod?: string;
  paymentMethod?: string;
  orderStatus?: string;
  startDate?: string;
  endDate?: string;
}

type Wrapped<T> = { success?: boolean; data?: T };

/**
 * Zips the sales endpoint's two parallel arrays into points.
 *
 * `labels` and `salesData` are built by the same loop server-side, so they are
 * the same length - but they are zipped against the shorter of the two rather
 * than trusting that, since a mismatch would otherwise render `undefined`
 * revenue as a gap in the line.
 */
const toSalesPoints = (response: Wrapped<{ labels?: string[]; salesData?: number[] }>): SalesPoint[] => {
  const labels = response?.data?.labels ?? [];
  const values = response?.data?.salesData ?? [];
  const count = Math.min(labels.length, values.length);

  return Array.from({ length: count }, (_, i) => ({
    label: String(labels[i]),
    revenue: Number(values[i] ?? 0)
  }));
};

/** The three ranked lists differ only in which key holds the name. */
const toRanked = (response: Wrapped<Array<Record<string, unknown>>>): RankedItem[] =>
  (response?.data ?? []).map((row, index) => ({
    id: String(row._id ?? index),
    label: String(row.productName ?? row.categoryName ?? row.brandName ?? 'Unknown'),
    quantity: Number(row.totalQuantity ?? 0),
    revenue: Number(row.totalRevenue ?? 0)
  }));

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query<DashboardStats, Period>({
      query: (period) => ({ url: '/admin/dashboard/api/stats', params: { period } }),
      transformResponse: (response: Wrapped<Partial<DashboardStats>>): DashboardStats => ({
        totalCustomers: Number(response?.data?.totalCustomers ?? 0),
        totalOrders: Number(response?.data?.totalOrders ?? 0),
        totalRevenue: Number(response?.data?.totalRevenue ?? 0),
        pendingOrders: Number(response?.data?.pendingOrders ?? 0)
      })
    }),

    getDashboardSales: build.query<SalesPoint[], Period>({
      query: (period) => ({ url: '/admin/dashboard/api/sales', params: { period } }),
      transformResponse: toSalesPoints
    }),

    getRevenueDistribution: build.query<RevenueSlice[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/revenue-distribution',
        params: { period }
      }),
      transformResponse: (
        response: Wrapped<Array<{ paymentMethod?: string; revenue?: number; percentage?: string }>>
      ): RevenueSlice[] =>
        (response?.data ?? []).map((slice) => ({
          name: String(slice.paymentMethod ?? 'Unknown'),
          value: Number(slice.revenue ?? 0),
          // The server sends this as a formatted string, e.g. "42.86".
          percentage: Number(slice.percentage ?? 0)
        }))
    }),

    getBestSellingProducts: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/best-selling-products',
        params: { period, limit: 10 }
      }),
      transformResponse: toRanked
    }),

    getBestSellingCategories: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/best-selling-categories',
        params: { period, limit: 10 }
      }),
      transformResponse: toRanked
    }),

    getBestSellingBrands: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/best-selling-brands',
        params: { period, limit: 10 }
      }),
      transformResponse: toRanked
    }),

    getSalesReport: build.query<SalesReport, ReportFilters>({
      query: (filters) => ({
        url: '/admin/sales-report',
        params: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== '' && value != null)
        )
      })
    })
  })
});

export const {
  useGetDashboardStatsQuery,
  useGetDashboardSalesQuery,
  useGetRevenueDistributionQuery,
  useGetBestSellingProductsQuery,
  useGetBestSellingCategoriesQuery,
  useGetBestSellingBrandsQuery,
  useGetSalesReportQuery
} = reportsApi;
