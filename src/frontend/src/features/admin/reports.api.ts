import { api } from '@/api/api';

/**
 * Dashboard and sales report.
 *
 * The dashboard is eight separate endpoints, all keyed on the same `period`.
 * They stayed separate rather than being combined server-side because each is
 * independently cacheable and the page can render whichever arrive first.
 */

export type Period = 'weekly' | 'monthly' | 'yearly';

export interface DashboardStats {
  totalRevenue?: number;
  totalOrders?: number;
  totalCustomers?: number;
  totalProducts?: number;
  [key: string]: unknown;
}

export interface SalesPoint {
  label?: string;
  date?: string;
  _id?: string;
  revenue?: number;
  orders?: number;
  [key: string]: unknown;
}

export interface RankedItem {
  _id?: string;
  name?: string;
  productName?: string;
  totalSold?: number;
  count?: number;
  revenue?: number;
  [key: string]: unknown;
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

/** The dashboard endpoints wrap their payload inconsistently. */
const unwrap = <T,>(response: { data?: T } & T): T =>
  (response?.data ?? response) as T;

export const reportsApi = api.injectEndpoints({
  endpoints: (build) => ({
    getDashboardStats: build.query<DashboardStats, Period>({
      query: (period) => ({ url: '/admin/dashboard/api/stats', params: { period } }),
      transformResponse: unwrap<DashboardStats>
    }),

    getDashboardSales: build.query<SalesPoint[], Period>({
      query: (period) => ({ url: '/admin/dashboard/api/sales', params: { period } }),
      transformResponse: (response: { data?: SalesPoint[]; sales?: SalesPoint[] }) =>
        response.data ?? response.sales ?? []
    }),

    getRevenueDistribution: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/revenue-distribution',
        params: { period }
      }),
      transformResponse: (response: { data?: RankedItem[] }) => response.data ?? []
    }),

    getBestSellingProducts: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/best-selling-products',
        params: { period, limit: 10 }
      }),
      transformResponse: (response: { data?: RankedItem[]; products?: RankedItem[] }) =>
        response.data ?? response.products ?? []
    }),

    getBestSellingCategories: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/best-selling-categories',
        params: { period, limit: 10 }
      }),
      transformResponse: (response: { data?: RankedItem[]; categories?: RankedItem[] }) =>
        response.data ?? response.categories ?? []
    }),

    getBestSellingBrands: build.query<RankedItem[], Period>({
      query: (period) => ({
        url: '/admin/dashboard/api/best-selling-brands',
        params: { period, limit: 10 }
      }),
      transformResponse: (response: { data?: RankedItem[]; brands?: RankedItem[] }) =>
        response.data ?? response.brands ?? []
    }),

    /**
     * The sales report as JSON.
     *
     * This endpoint did not exist until step 11: the EJS page refetched its
     * own HTML and swapped nodes with DOMParser, and the controller had no
     * branch for the header it sent, so it returned the whole page every time.
     */
    getSalesReport: build.query<SalesReport, ReportFilters>({
      query: (filters) => ({
        url: '/admin/sales-report',
        params: Object.fromEntries(
          Object.entries(filters).filter(([, value]) => value !== '' && value != null)
        )
      }),
      providesTags: ['Order']
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
