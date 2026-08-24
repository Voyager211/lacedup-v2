import { api } from '@/api/api';
import type { AddressLine } from '@/features/checkout/checkout.api';

/**
 * Address endpoints.
 *
 * Addresses live as an array inside a single document per user, which is why
 * the read returns a list but writes are keyed by the *line* id. The states
 * and districts list is fetched rather than bundled - the EJS layer shipped
 * ~40KB of it as a JavaScript literal while also serving it from here.
 */

export interface StatesDistricts {
  [slug: string]: { name: string; districts: string[] };
}

export const addressApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAddresses: build.query<{ addresses: AddressLine[]; addressDocumentId?: string }, void>({
      query: () => ({ url: '/addresses' }),
      transformResponse: (response: {
        addresses?: AddressLine[];
        addressDocumentId?: string;
        _id?: string;
      }) => ({
        addresses: response.addresses ?? [],
        ...(response.addressDocumentId ?? response._id
          ? { addressDocumentId: response.addressDocumentId ?? response._id }
          : {})
      }),
      providesTags: ['Address']
    }),

    addAddress: build.mutation<{ success: boolean; message?: string }, AddressLine>({
      query: (body) => ({ url: '/address', method: 'POST', data: body }),
      invalidatesTags: ['Address']
    }),

    updateAddress: build.mutation<
      { success: boolean; message?: string },
      { addressId: string; address: AddressLine }
    >({
      query: ({ addressId, address }) => ({
        url: `/address/${addressId}`,
        method: 'PUT',
        data: address
      }),
      invalidatesTags: ['Address']
    }),

    deleteAddress: build.mutation<{ success: boolean; message?: string }, string>({
      query: (addressId) => ({ url: `/address/${addressId}`, method: 'DELETE' }),
      invalidatesTags: ['Address']
    }),

    setDefaultAddress: build.mutation<{ success: boolean; message?: string }, string>({
      query: (addressId) => ({ url: `/address/${addressId}/default`, method: 'PATCH' }),
      invalidatesTags: ['Address']
    }),

    /**
     * Fetched, never bundled. `stateDistrictData.js` shipped the same ~700
     * districts to every visitor as a literal, and it is already an endpoint.
     * Held for the whole session since it does not change.
     */
    getStatesDistricts: build.query<StatesDistricts, void>({
      query: () => ({ url: '/states-districts' }),
      /*
       * The map is nested: `{ success, data: { 'kerala': { name, districts } } }`.
       * Unwrapped here, because without it `Object.values(response)` yielded
       * `[true, {…}]` - the `success` flag alongside the map - and reading
       * `.name` off `true` threw "Cannot read properties of undefined
       * (reading 'localeCompare')" while sorting, which took checkout down.
       */
      transformResponse: (
        response: { data?: StatesDistricts; states?: StatesDistricts } | StatesDistricts
      ): StatesDistricts => {
        const wrapped = response as { data?: StatesDistricts; states?: StatesDistricts };
        const map = wrapped.data ?? wrapped.states ?? (response as StatesDistricts);

        // Guard the shape as well as the nesting: one malformed entry should
        // leave the state list short, not break the page it is rendered on.
        return Object.fromEntries(
          Object.entries(map ?? {}).filter(
            ([, entry]) => entry && typeof entry === 'object' && typeof entry.name === 'string'
          )
        );
      },
      keepUnusedDataFor: 3600
    })
  })
});

export const {
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
  useGetStatesDistrictsQuery
} = addressApi;
