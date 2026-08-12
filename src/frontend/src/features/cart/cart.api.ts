import { api } from '@/api/api';

/**
 * Cart endpoints.
 *
 * Only the count for now - the shell needs it for the navbar badge. The rest
 * lands with the cart page in step 5.
 */
export const cartApi = api.injectEndpoints({
  endpoints: (build) => ({
    getCartCount: build.query<number, void>({
      query: () => ({ url: '/cart/count' }),
      transformResponse: (response: { count?: number }) => response.count ?? 0,
      providesTags: ['CartCount']
    })
  })
});

export const { useGetCartCountQuery } = cartApi;
