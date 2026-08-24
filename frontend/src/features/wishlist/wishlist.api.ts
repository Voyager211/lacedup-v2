import { api } from '@/api/api';
import type { Product } from '@/types/catalog';

/**
 * Wishlist endpoints.
 *
 * `GET /api/wishlist` is the same route the EJS page uses - the router is
 * dual-mounted, and the handler answers JSON when the request arrives under
 * /api. There is no separate endpoint to keep in step.
 */

export interface WishlistResponse {
  success: boolean;
  products: Product[];
  search: string;
  userWishlistProductIds: string[];
}

export interface WishlistMutationResult {
  success: boolean;
  message?: string;
  wishlistCount?: number;
}

export const wishlistApi = api.injectEndpoints({
  endpoints: (build) => ({
    getWishlist: build.query<WishlistResponse, string | void>({
      query: (search) => ({ url: '/wishlist', params: search ? { q: search } : undefined }),
      providesTags: ['Wishlist']
    }),

    addToWishlist: build.mutation<WishlistMutationResult, string>({
      query: (productId) => ({ url: '/wishlist/add', method: 'POST', data: { productId } }),
      invalidatesTags: ['Wishlist']
    }),

    removeFromWishlist: build.mutation<WishlistMutationResult, string>({
      query: (productId) => ({ url: `/wishlist/remove/${productId}`, method: 'DELETE' }),
      invalidatesTags: ['Wishlist']
    })
  })
});

export const {
  useGetWishlistQuery,
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation
} = wishlistApi;
