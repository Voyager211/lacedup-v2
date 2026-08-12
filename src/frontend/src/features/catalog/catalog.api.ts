import { api } from '@/api/api';

/**
 * Catalog endpoints the shell needs.
 *
 * Shop listing and product details land with step 4; this is only what the
 * navbar search uses.
 */

export interface SuggestionVariant {
  basePrice?: number;
  finalPrice?: number;
  variantSpecificOffer?: number;
}

export interface Suggestion {
  _id: string;
  productName: string;
  slug: string;
  mainImage?: string;
  regularPrice?: number;
  averageFinalPrice?: number;
  brand?: { name: string } | null;
  category?: { name: string } | null;
  variants?: SuggestionVariant[];
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
      // Suggestions go stale quickly and are cheap to refetch; holding them for
      // a minute keeps repeat searches instant without risking a stale price.
      keepUnusedDataFor: 60
    })
  })
});

export const { useGetSearchSuggestionsQuery } = catalogApi;
