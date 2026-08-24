import { api } from '@/api/api';
import type { Product, Variant } from '@/types/catalog';

/**
 * Admin catalog endpoints.
 *
 * Products, categories, brands and coupons are very nearly the same resource
 * four times over:
 *
 *   GET    /admin/{r}/api?q&status&page   list
 *   GET    /admin/{r}/api/:id             read one
 *   POST   /admin/{r}/api/create          create
 *   PUT    /admin/{r}/api/:id             update
 *   PATCH  /admin/{r}/api/:id/toggle      activate / deactivate
 *   DELETE /admin/{r}/api/:id             soft delete
 *
 * Two deviate, and the deviations are the reason this is a config table rather
 * than a loop: coupons put create/read/update outside the `/api` segment, and
 * products soft-delete with PATCH .../api/:id/delete instead of DELETE.
 */

export type ResourceKey = 'categories' | 'brands' | 'coupons' | 'products';

interface ResourcePaths {
  list: string;
  one: (id: string) => string;
  create: string;
  update: (id: string) => string;
  toggle: (id: string) => string;
  remove: (id: string) => string;
  removeMethod: 'DELETE' | 'PATCH';
}

const standard = (resource: string): ResourcePaths => ({
  list: `/admin/${resource}/api`,
  one: (id) => `/admin/${resource}/api/${id}`,
  create: `/admin/${resource}/api/create`,
  update: (id) => `/admin/${resource}/api/${id}`,
  toggle: (id) => `/admin/${resource}/api/${id}/toggle`,
  remove: (id) => `/admin/${resource}/api/${id}`,
  removeMethod: 'DELETE'
});

export const RESOURCE_PATHS: Record<ResourceKey, ResourcePaths> = {
  categories: standard('categories'),
  brands: standard('brands'),

  // Create, read and update sit outside /api on this one.
  coupons: {
    ...standard('coupons'),
    one: (id) => `/admin/coupons/${id}`,
    create: '/admin/coupons/create',
    update: (id) => `/admin/coupons/${id}`
  },

  // Soft delete is a PATCH here, not a DELETE.
  products: {
    ...standard('products'),
    create: '/admin/products/api/add',
    remove: (id) => `/admin/products/api/${id}/delete`,
    removeMethod: 'PATCH'
  }
};

export interface AdminListQuery {
  page?: number;
  q?: string;
  status?: string;
  [key: string]: unknown;
}

export interface AdminRecord {
  _id: string;
  name?: string;
  productName?: string;
  code?: string;
  isActive?: boolean;
  isListed?: boolean;
  isDeleted?: boolean;
  [key: string]: unknown;
}

export interface AdminListResponse {
  items: AdminRecord[];
  currentPage: number;
  totalPages: number;
  totalRecords: number;
}

/**
 * The four list endpoints agree on almost everything and disagree on the key
 * their array lives under, and coupons nests its pagination. Normalising here
 * keeps that out of the page.
 */
/** The key each endpoint puts its rows under. */
const COLLECTION_KEYS = ['categories', 'brands', 'coupons', 'products'] as const;

/**
 * Finds the rows and the paging, wherever the endpoint chose to put them.
 *
 * Three of the four are flat - `{ categories, currentPage, totalPages,
 * totalRecords }`. Coupons wraps everything one level deeper:
 *
 *   { success, message, data: { coupons, count, totalCount, pagination: {…} } }
 *
 * The old version only looked at the top level, so for coupons it fell through
 * to `response.data` - an object, not an array - and the page rendered nothing.
 * Unwrapping `data` first when it holds a collection covers both without the
 * caller needing to know which sort of endpoint it is talking to.
 */
const normaliseList = (response: Record<string, unknown>): AdminListResponse => {
  const data = response.data as Record<string, unknown> | undefined;

  const holdsRows = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) &&
    typeof value === 'object' &&
    COLLECTION_KEYS.some((key) => Array.isArray((value as Record<string, unknown>)[key]));

  // The envelope that actually carries the rows.
  const body = holdsRows(data) ? data : response;

  const items =
    (COLLECTION_KEYS.map((key) => body[key]).find(Array.isArray) as AdminRecord[] | undefined) ??
    (Array.isArray(response.data) ? (response.data as AdminRecord[]) : undefined) ??
    [];

  const pagination = (body.pagination ?? body) as Record<string, unknown>;

  return {
    items,
    currentPage: Number(pagination.currentPage ?? 1),
    totalPages: Number(pagination.totalPages ?? 1),
    totalRecords: Number(
      // `totalCount` is the coupons endpoint's name for it.
      pagination.totalRecords ??
        body.totalCount ??
        pagination.totalCoupons ??
        pagination.total ??
        items.length
    )
  };
};

/**
 * A variant with the offer the backend picked for it already resolved.
 *
 * `offerSource` is omitted from the base type and redeclared because the two
 * endpoints spell it differently: the admin controller sends 'Brand', the
 * storefront sends 'brand'. Worth reconciling; until then, saying so here beats
 * a type that quietly claims they are the same.
 */
export interface AdminVariant extends Omit<Variant, 'offerSource'> {
  calculatedFinalPrice?: number;
  appliedOffer?: number;
  /** Which offer won: Brand, Category, Variant, Product, or None. */
  offerSource?: string;
}

export interface ActiveOffer {
  type: string;
  name: string;
  value: number;
  label: string;
}

export interface AdminProductDetail {
  success?: boolean;
  product: Omit<Product, 'variants'> & { variants: AdminVariant[] };
  /** Main image first, then the sub-images - assembled by the controller. */
  allImages: string[];
  activeOffers: ActiveOffer[];
}

const TAG: Record<ResourceKey, 'Category' | 'Brand' | 'Coupon' | 'Product'> = {
  categories: 'Category',
  brands: 'Brand',
  coupons: 'Coupon',
  products: 'Product'
};

export const adminApi = api.injectEndpoints({
  endpoints: (build) => ({
    getAdminList: build.query<AdminListResponse, { resource: ResourceKey; query: AdminListQuery }>({
      query: ({ resource, query }) => ({
        url: RESOURCE_PATHS[resource].list,
        params: Object.fromEntries(
          Object.entries(query).filter(([, value]) => value !== '' && value != null)
        )
      }),
      transformResponse: normaliseList,
      providesTags: (_result, _error, { resource }) => [TAG[resource]]
    }),

    getAdminRecord: build.query<AdminRecord, { resource: ResourceKey; id: string }>({
      query: ({ resource, id }) => ({ url: RESOURCE_PATHS[resource].one(id) }),
      /*
       * Same split as the list endpoints: most return the record at the top
       * level, coupons nests it as `{ data: { coupon } }`. Unwrap `data` first
       * when it holds one, or the dialog opens with every field empty.
       */
      transformResponse: (response: Record<string, unknown>) => {
        const data = (response.data ?? {}) as Record<string, unknown>;
        const nested = data.coupon ?? data.category ?? data.brand ?? data.product;

        return (nested ??
          response.category ??
          response.brand ??
          response.coupon ??
          response.product ??
          response.data ??
          response) as AdminRecord;
      }
    }),

    createAdminRecord: build.mutation<
      { success?: boolean; message?: string },
      { resource: ResourceKey; body: unknown }
    >({
      query: ({ resource, body }) => ({
        url: RESOURCE_PATHS[resource].create,
        method: 'POST',
        data: body
      }),
      invalidatesTags: (_result, _error, { resource }) => [TAG[resource]]
    }),

    updateAdminRecord: build.mutation<
      { success?: boolean; message?: string },
      { resource: ResourceKey; id: string; body: unknown }
    >({
      query: ({ resource, id, body }) => ({
        url: RESOURCE_PATHS[resource].update(id),
        method: 'PUT',
        data: body
      }),
      invalidatesTags: (_result, _error, { resource }) => [TAG[resource]]
    }),

    toggleAdminRecord: build.mutation<
      { success?: boolean; message?: string },
      { resource: ResourceKey; id: string }
    >({
      query: ({ resource, id }) => ({
        url: RESOURCE_PATHS[resource].toggle(id),
        method: 'PATCH'
      }),
      // Deactivating a category or brand hides its products from the
      // storefront, so the product list is stale too.
      invalidatesTags: (_result, _error, { resource }) => [TAG[resource], 'Product']
    }),

    deleteAdminRecord: build.mutation<
      { success?: boolean; message?: string },
      { resource: ResourceKey; id: string }
    >({
      query: ({ resource, id }) => ({
        url: RESOURCE_PATHS[resource].remove(id),
        method: RESOURCE_PATHS[resource].removeMethod
      }),
      invalidatesTags: (_result, _error, { resource }) => [TAG[resource], 'Product']
    }),

    /**
     * The admin product detail view.
     *
     * Separate from `getAdminRecord` because the controller sends more than the
     * stored document: every variant carries the winning offer and the price it
     * produces, and `activeOffers` is the set of offers that competed. Those are
     * computed server-side and must not be recomputed here - the point of the
     * page is to show which offer the backend actually applied.
     */
    getAdminProductDetail: build.query<AdminProductDetail, string>({
      // No leading /api: the axios client's baseURL already supplies it, so
      // writing it here produced /api/api/admin/products/:id and a 404.
      query: (id) => ({ url: `/admin/products/${id}` }),
      providesTags: ['Product']
    })
  })
});

export const {
  useGetAdminListQuery,
  useGetAdminRecordQuery,
  useGetAdminProductDetailQuery,
  useCreateAdminRecordMutation,
  useUpdateAdminRecordMutation,
  useToggleAdminRecordMutation,
  useDeleteAdminRecordMutation
} = adminApi;
