import { api } from '@/api/api';
import type { Product } from '@/types/catalog';

/**
 * Cart endpoints.
 *
 * Every mutation invalidates both `Cart` and `CartCount`, so the page and the
 * navbar badge stay in step without any component telling the other. The EJS
 * layer did this by calling a global `window.updateNavbarCartCount` from four
 * different scripts.
 */

export interface CartItem {
  _id: string;
  productId: Product;
  variantId?: string;
  sku?: string;
  size?: string;
  quantity: number;
  price: number;
  totalPrice: number;
  /** Set by the server while partitioning. */
  isOutOfStock?: boolean;
  isUnavailable?: boolean;
  unavailableReason?: string;
}

export interface CartResponse {
  success: boolean;
  cartItems: CartItem[];
  availableCartItems: CartItem[];
  outOfStockCartItems: CartItem[];
  unavailableCartItems: CartItem[];
}

export interface CartMutationResult {
  success: boolean;
  message?: string;
  cartCount?: number;
  /** Present on stock failures - OUT_OF_STOCK, INSUFFICIENT_STOCK, CART_QUANTITY_LIMIT. */
  code?: string;
  availableStock?: number;
}

const INVALIDATES = ['Cart', 'CartCount'] as const;

export const cartApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCartCount: build.query<number, void>({
      query: () => ({ url: '/cart/count' }),
      transformResponse: (response: { count?: number }) => response.count ?? 0,
      providesTags: ['CartCount']
    }),

    /**
     * The cart, already partitioned by the server into what can be bought,
     * what is out of stock, and what is no longer sold. It also re-prices
     * anything whose offer moved since it was added, which is why the page
     * must not cache a price of its own.
     */
    getCart: build.query<CartResponse, void>({
      query: () => ({ url: '/cart' }),
      providesTags: ['Cart']
    }),

    addToCart: build.mutation<
      CartMutationResult,
      { productId: string; variantId: string; quantity?: number }
    >({
      query: (body) => ({ url: '/cart/add', method: 'POST', data: body }),
      // Adding also removes the product from the wishlist server-side.
      invalidatesTags: [...INVALIDATES, 'Wishlist']
    }),

    updateCartQuantity: build.mutation<
      CartMutationResult,
      { productId: string; variantId: string; quantity: number }
    >({
      query: (body) => ({ url: '/cart/update', method: 'POST', data: body }),
      invalidatesTags: [...INVALIDATES]
    }),

    removeFromCart: build.mutation<CartMutationResult, { productId: string; variantId?: string }>({
      query: (body) => ({ url: '/cart/remove', method: 'POST', data: body }),
      invalidatesTags: [...INVALIDATES]
    }),

    clearCart: build.mutation<CartMutationResult, void>({
      query: () => ({ url: '/cart/clear', method: 'POST' }),
      invalidatesTags: [...INVALIDATES]
    }),

    removeOutOfStock: build.mutation<CartMutationResult & { removedCount?: number }, void>({
      query: () => ({ url: '/cart/remove-out-of-stock', method: 'POST' }),
      invalidatesTags: [...INVALIDATES]
    }),

    /** Moves an item to the wishlist, so both caches are stale afterwards. */
    saveForLater: build.mutation<CartMutationResult, { productId: string; variantId?: string }>({
      query: (body) => ({ url: '/cart/save-for-later', method: 'POST', data: body }),
      invalidatesTags: [...INVALIDATES, 'Wishlist']
    })
  })
});

export const {
  useGetCartCountQuery,
  useGetCartQuery,
  useAddToCartMutation,
  useUpdateCartQuantityMutation,
  useRemoveFromCartMutation,
  useClearCartMutation,
  useRemoveOutOfStockMutation,
  useSaveForLaterMutation
} = cartApi;
