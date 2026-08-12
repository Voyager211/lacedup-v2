import { createApi } from '@reduxjs/toolkit/query/react';
import { axiosBaseQuery } from './baseQuery';

/**
 * The single API slice.
 *
 * Endpoints are injected per feature via `api.injectEndpoints` rather than
 * declared here, so each feature folder owns its own calls and this file does
 * not become a list of everything the app can do.
 *
 * Tags are declared up front because invalidation crosses features: placing an
 * order empties the cart and moves the wallet balance, so the checkout feature
 * has to invalidate tags the cart and wallet features own.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: axiosBaseQuery(),
  tagTypes: [
    'Cart',
    'CartCount',
    'Wishlist',
    'Product',
    'Category',
    'Brand',
    'Order',
    'Return',
    'Address',
    'Wallet',
    'Coupon',
    'Referral',
    'Review',
    'User'
  ],
  endpoints: () => ({})
});
