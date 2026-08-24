import { api } from '@/api/api';
import type {
  FilterOptions,
  HomeSections,
  Product,
  ProductDetails,
  ShopQuery,
  ShopResponse
} from '@/types/catalog';

export interface Suggestion extends Pick<Product, '_id' | 'productName' | 'slug'> {
  mainImage?: string;
  regularPrice?: number;
  averageFinalPrice?: number;
  brand?: { name: string } | null;
  category?: { name: string } | null;
}

export const catalogApi = api.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Type-ahead suggestions.
     *
     * The endpoint returns whole products - image, slug, brand and computed
     * prices - but the EJS typeahead rendered only `productName` and threw the
     * rest away. Showing the image and price costs nothing extra over the wire.
     */
    getSearchSuggestions: build.query<Suggestion[], string>({
      query: (q) => ({ url: '/search-suggestions', params: { q } }),
      transformResponse: (response: { suggestions?: Suggestion[] }) => response.suggestions ?? [],
      keepUnusedDataFor: 60
    }),

    /**
     * The shop listing.
     *
     * Empty values are stripped rather than sent as `?category=&brand=`, which
     * keeps the cache key stable - otherwise clearing a filter produces a
     * different key for an identical result set.
     */
    getProducts: build.query<ShopResponse, ShopQuery>({
      query: (params) => ({
        url: '/shop',
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== '' && value != null)
        )
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.products.map(({ _id }) => ({ type: 'Product' as const, id: _id })),
              { type: 'Product' as const, id: 'LIST' }
            ]
          : [{ type: 'Product' as const, id: 'LIST' }]
    }),

    getProduct: build.query<ProductDetails, string>({
      query: (slug) => ({ url: `/product/${slug}` }),
      providesTags: (result) =>
        result ? [{ type: 'Product', id: result.product._id }] : ['Product']
    }),

    /** Categories, brands and in-stock sizes for the filter panel. */
    getFilterOptions: build.query<FilterOptions, void>({
      query: () => ({ url: '/catalog/filters' }),
      // These change when an admin edits the catalog, which is rare, and the
      // panel is on screen for the whole visit.
      keepUnusedDataFor: 600,
      providesTags: ['Category', 'Brand']
    }),

    getHomeSections: build.query<HomeSections, void>({
      query: () => ({ url: '/home-sections' }),
      keepUnusedDataFor: 300,
      providesTags: [{ type: 'Product', id: 'LIST' }]
    })
  })
});

export const {
  useGetSearchSuggestionsQuery,
  useGetProductsQuery,
  useGetProductQuery,
  useGetFilterOptionsQuery,
  useGetHomeSectionsQuery
} = catalogApi;
