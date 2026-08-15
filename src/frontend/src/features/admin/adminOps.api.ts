import { api } from '@/api/api';

/**
 * Admin orders, returns and users.
 *
 * Separate from admin.api.ts because these are not the four-CRUD-resources
 * shape: orders have a status machine, returns have an approve/reject
 * decision, and users only block and unblock.
 */

export interface AdminOrderRow {
  _id: string;
  orderId: string;
  orderDate?: string;
  createdAt?: string;
  customerName?: string;
  productName?: string;
  size?: string;
  quantity?: number;
  totalPrice?: number;
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  [key: string]: unknown;
}

export interface AdminOrdersPage {
  orders: AdminOrderRow[];
  currentPage: number;
  totalPages: number;
  /**
   * Rows across every page, which is what the header bar counts.
   *
   * `totalCount` and not `totalOrders`: the controller sends both names for
   * different things - `data.totalCount` is the row total, while
   * `data.statistics.totalOrders` is a separate statistic. This interface
   * declared `totalOrders` at the top level, where nothing sends it. Nothing
   * read it either, so it was a latent lie rather than a live bug; the header
   * would have found it the hard way.
   */
  totalCount?: number;
}

export interface AdminOrderDetails {
  order: Record<string, unknown> & {
    orderId: string;
    status: string;
    items: Array<Record<string, unknown> & { _id: string; status?: string }>;
  };
  orderStatuses?: string[];
  validTransitions?: string[];
}

export interface AdminReturnRow {
  _id: string;
  returnId?: string;
  orderId?: string;
  status: string;
  reason?: string;
  refundAmount?: number;
  totalPrice?: number;
  requestDate?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface AdminUserRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  isBlocked?: boolean;
  createdAt?: string;
}

interface MutationResult {
  success?: boolean;
  message?: string;
}

export const adminOpsApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * The admin order list is item-level, not order-level: the aggregation
     * unwinds items, so one order with three lines appears as three rows and
     * the status filter matches an item's status rather than the order's.
     */
    getAdminOrders: build.query<AdminOrdersPage, Record<string, unknown>>({
      query: (params) => ({
        url: '/admin/orders/api/filtered',
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value != null)
        )
      }),
      transformResponse: (response: { data?: AdminOrdersPage }) =>
        response.data ?? { orders: [], currentPage: 1, totalPages: 1 },
      providesTags: ['Order']
    }),

    getAdminOrderStatistics: build.query<Record<string, unknown>, void>({
      query: () => ({ url: '/admin/orders/api/statistics' }),
      transformResponse: (response: { data?: Record<string, unknown> }) => response.data ?? {},
      providesTags: ['Order']
    }),

    getAdminOrder: build.query<AdminOrderDetails, string>({
      query: (orderId) => ({ url: `/admin/orders/api/${orderId}` }),
      transformResponse: (response: { data?: AdminOrderDetails } & AdminOrderDetails) =>
        response.data ?? response,
      providesTags: (_r, _e, orderId) => [{ type: 'Order', id: orderId }]
    }),

    /**
     * Which statuses this order may move to next.
     *
     * Returns an empty list for Partially Delivered and Partially Returned -
     * the server has no order-level transitions for those. The EJS admin
     * rendered that as an empty dropdown with no explanation; the page says
     * why instead.
     */
    getOrderTransitions: build.query<
      { currentStatus: string; allowedTransitions: string[] },
      string
    >({
      query: (orderId) => ({ url: `/admin/orders/${orderId}/transitions` }),
      providesTags: (_r, _e, orderId) => [{ type: 'Order', id: orderId }]
    }),

    updateOrderStatus: build.mutation<
      MutationResult,
      { orderId: string; status: string; notes?: string }
    >({
      query: ({ orderId, ...body }) => ({
        url: `/admin/orders/${orderId}`,
        method: 'PATCH',
        data: body
      }),
      invalidatesTags: ['Order']
    }),

    updateItemStatus: build.mutation<
      MutationResult,
      { orderId: string; itemId: string; status: string; notes?: string }
    >({
      query: ({ orderId, itemId, ...body }) => ({
        url: `/admin/orders/${orderId}/items/${itemId}/status`,
        method: 'PATCH',
        data: body
      }),
      // An item update recomputes the order's own status, so the list is stale
      // as well as this order.
      invalidatesTags: ['Order']
    }),

    getAdminReturns: build.query<
      { returns: AdminReturnRow[]; currentPage: number; totalPages: number; totalReturns?: number },
      Record<string, unknown>
    >({
      query: (params) => ({
        url: '/admin/returns/api/filtered',
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value != null)
        )
      }),
      transformResponse: (response: {
        data?: {
          returns: AdminReturnRow[];
          currentPage: number;
          totalPages: number;
          totalReturns?: number;
        };
      }) => response.data ?? { returns: [], currentPage: 1, totalPages: 1 },
      providesTags: ['Return']
    }),

    approveReturn: build.mutation<MutationResult, { returnId: string; notes?: string }>({
      query: ({ returnId, ...body }) => ({
        url: `/admin/returns/${returnId}/approve`,
        method: 'PATCH',
        data: body
      }),
      // Approving refunds to the shopper's wallet and returns stock.
      invalidatesTags: ['Return', 'Order', 'Wallet', 'Product']
    }),

    rejectReturn: build.mutation<MutationResult, { returnId: string; reason?: string }>({
      query: ({ returnId, ...body }) => ({
        url: `/admin/returns/${returnId}/reject`,
        method: 'PATCH',
        data: body
      }),
      invalidatesTags: ['Return', 'Order']
    }),

    getAdminUsers: build.query<
      { users: AdminUserRow[]; currentPage: number; totalPages: number; totalUsers?: number },
      Record<string, unknown>
    >({
      query: (params) => ({
        url: '/admin/users/api',
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value != null)
        )
      }),
      providesTags: ['User']
    }),

    /**
     * Blocking takes effect immediately, not at token expiry: the JWT
     * middleware checks current user state on every request and blocking also
     * revokes every outstanding refresh token.
     */
    blockUser: build.mutation<MutationResult, string>({
      query: (id) => ({ url: `/admin/users/${id}/block`, method: 'PATCH' }),
      invalidatesTags: ['User']
    }),

    unblockUser: build.mutation<MutationResult, string>({
      query: (id) => ({ url: `/admin/users/${id}/unblock`, method: 'PATCH' }),
      invalidatesTags: ['User']
    })
  })
});

export const {
  useGetAdminOrdersQuery,
  useGetAdminOrderStatisticsQuery,
  useGetAdminOrderQuery,
  useGetOrderTransitionsQuery,
  useUpdateOrderStatusMutation,
  useUpdateItemStatusMutation,
  useGetAdminReturnsQuery,
  useApproveReturnMutation,
  useRejectReturnMutation,
  useGetAdminUsersQuery,
  useBlockUserMutation,
  useUnblockUserMutation
} = adminOpsApi;
