import { api } from '@/api/api';

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
const normaliseList = (response: Record<string, unknown>): AdminListResponse => {
  const items =
    (response.categories as AdminRecord[]) ??
    (response.brands as AdminRecord[]) ??
    (response.coupons as AdminRecord[]) ??
    (response.products as AdminRecord[]) ??
    (response.data as AdminRecord[]) ??
    [];

  const pagination = (response.pagination ?? response) as Record<string, unknown>;

  return {
    items,
    currentPage: Number(pagination.currentPage ?? 1),
    totalPages: Number(pagination.totalPages ?? 1),
    totalRecords: Number(
      pagination.totalRecords ?? pagination.totalCoupons ?? pagination.total ?? items.length
    )
  };
};

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
      transformResponse: (response: Record<string, unknown>) =>
        (response.category ??
          response.brand ??
          response.coupon ??
          response.product ??
          response.data ??
          response) as AdminRecord
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
    })
  })
});

export const {
  useGetAdminListQuery,
  useGetAdminRecordQuery,
  useCreateAdminRecordMutation,
  useUpdateAdminRecordMutation,
  useToggleAdminRecordMutation,
  useDeleteAdminRecordMutation
} = adminApi;
