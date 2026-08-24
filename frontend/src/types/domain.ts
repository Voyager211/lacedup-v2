/**
 * Domain constants mirrored from the backend.
 *
 * These are the literal string values the API sends and accepts. They mirror
 * backend/src/common/constants/order.constants.ts - if that file changes, this
 * one has to change with it, and the `satisfies` checks at the bottom of the
 * badge tone maps will fail loudly rather than silently drifting.
 */

export const ORDER_STATUS = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
  FAILED: 'Failed',
  PARTIALLY_RETURNED: 'Partially Returned',
  PARTIALLY_DELIVERED: 'Partially Delivered',
  PROCESSING_RETURN: 'Processing Return'
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'Pending',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  CANCELLED: 'Cancelled',
  PARTIALLY_COMPLETED: 'Partially Completed',
  PARTIALLY_REFUNDED: 'Partially Refunded'
} as const;

export const RETURN_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed'
} as const;

export const PAYMENT_METHODS = {
  COD: 'cod',
  CARD: 'card',
  UPI: 'upi',
  PAYPAL: 'paypal',
  NETBANKING: 'netbanking',
  WALLET: 'wallet'
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type ReturnStatus = (typeof RETURN_STATUS)[keyof typeof RETURN_STATUS];
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

/** The two independent auth audiences. One browser can hold both at once. */
export type Audience = 'user' | 'admin';

export interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profilePhoto?: string;
  role: 'user' | 'admin';
  isBlocked: boolean;
  referralCode?: string;
  referralCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** The envelope most controllers already return. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Pagination as the backend already sends it.
 *
 * Several endpoints spread these keys at the top level of the response rather
 * than nesting them, and some also send `pageNumbers`. Read the endpoint's
 * entry in docs/ before assuming a shape.
 */
export interface Pagination {
  currentPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
  pageNumbers?: number[];
}
