import { api } from '@/api/api';

/**
 * Order endpoints.
 *
 * Cancel and return exist at both order and item level. The order-level call
 * is not a shortcut for looping the items - the server recalculates the order
 * status from what remains, which is how an order becomes Partially Delivered
 * or Partially Returned.
 */

export interface OrderItem {
  _id: string;
  productId?: { _id?: string; productName?: string; slug?: string; mainImage?: string } | null;
  productName?: string;
  size?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  status?: string;
  cancellationReason?: string;
  returnReason?: string;
}

export interface Order {
  _id: string;
  orderId: string;
  items: OrderItem[];
  status: string;
  paymentStatus?: string;
  paymentMethod?: string;
  subtotal?: number;
  totalDiscount?: number;
  couponDiscount?: number;
  shipping?: number;
  totalAmount?: number;
  finalAmount?: number;
  createdAt: string;
  deliveryAddress?: Record<string, unknown>;
  comprehensiveStatusHistory?: Array<{ status?: string; date?: string; note?: string }>;
}

export interface OrdersPage {
  orders: Order[];
  currentPage: number;
  totalPages: number;
  totalOrders: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
}

export interface OrderListResponse extends OrdersPage {
  success: boolean;
  /** Server enums - the client never hardcodes these. */
  cancellationReasons: string[];
  returnReasons: string[];
}

export interface OrderDetailsResponse {
  success: boolean;
  order: Order;
  cancellationReasons: string[];
  returnReasons: string[];
}

export interface OrdersQuery {
  page?: number;
  status?: string;
  search?: string;
}

interface MutationResult {
  success: boolean;
  message?: string;
}

export const ordersApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * The first page, plus the reason lists.
     *
     * Loaded from `/orders` rather than `/orders/filtered` so the reason
     * enums arrive with it - the filtered endpoint returns only the page.
     */
    getOrders: build.query<OrderListResponse, void>({
      query: () => ({ url: '/orders' }),
      providesTags: ['Order']
    }),

    /** Filtering and paging, once the page is up. */
    getFilteredOrders: build.query<OrdersPage, OrdersQuery>({
      query: (params) => ({
        url: '/orders/filtered',
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value != null)
        )
      }),
      transformResponse: (response: { data: OrdersPage }) => response.data,
      providesTags: ['Order']
    }),

    getOrder: build.query<OrderDetailsResponse, string>({
      query: (orderId) => ({ url: `/orders/${orderId}` }),
      providesTags: (_result, _error, orderId) => [{ type: 'Order', id: orderId }]
    }),

    cancelOrder: build.mutation<MutationResult, { orderId: string; reason: string }>({
      query: ({ orderId, reason }) => ({
        url: `/orders/${orderId}`,
        method: 'PATCH',
        data: { reason }
      }),
      // A cancelled prepaid order refunds to the wallet and returns stock, so
      // both are stale afterwards.
      invalidatesTags: ['Order', 'Wallet', 'Product']
    }),

    cancelItem: build.mutation<
      MutationResult,
      { orderId: string; itemId: string; reason: string }
    >({
      query: ({ orderId, itemId, reason }) => ({
        url: `/orders/${orderId}/items/${itemId}`,
        method: 'PATCH',
        data: { reason }
      }),
      invalidatesTags: ['Order', 'Wallet', 'Product']
    }),

    returnOrder: build.mutation<MutationResult, { orderId: string; reason: string }>({
      query: ({ orderId, reason }) => ({
        url: `/orders/${orderId}/returns`,
        method: 'POST',
        data: { reason }
      }),
      invalidatesTags: ['Order', 'Return']
    }),

    returnItem: build.mutation<
      MutationResult,
      { orderId: string; itemId: string; reason: string }
    >({
      query: ({ orderId, itemId, reason }) => ({
        url: `/orders/${orderId}/items/${itemId}/returns`,
        method: 'POST',
        data: { reason }
      }),
      invalidatesTags: ['Order', 'Return']
    })
  })
});

export const {
  useGetOrdersQuery,
  useGetFilteredOrdersQuery,
  useGetOrderQuery,
  useCancelOrderMutation,
  useCancelItemMutation,
  useReturnOrderMutation,
  useReturnItemMutation
} = ordersApi;
