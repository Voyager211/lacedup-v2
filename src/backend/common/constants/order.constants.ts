/**
 * Order domain constants.
 *
 * Declared `as const` so each map yields a literal union type rather than
 * `string` - that is what makes OrderStatus, PaymentStatus and friends useful
 * as types across the rest of the backend.
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

export const CANCELLATION_REASONS = {
  ORDERED_BY_MISTAKE: 'Ordered by mistake',
  FOUND_BETTER_PRICE: 'Found a better price elsewhere',
  DELIVERY_TIME_LONG: 'Delivery time too long',
  PAYMENT_ISSUE: 'Payment issue',
  DUPLICATE_ORDER: 'Duplicate order',
  CHANGED_MIND: 'Changed my mind',
  PRODUCT_OUT_OF_STOCK: 'Product went out of stock',
  WRONG_SIZE: 'Wrong size selected',
  INCORRECT_ADDRESS: 'Incorrect or incomplete shipping address',
  SWITCHED_PRODUCT: 'Switched to a different product',
  OTHER: 'Other'
} as const;

export const RETURN_REASONS = {
  SIZE_TOO_SMALL: 'Size too small',
  SIZE_TOO_LARGE: 'Size too large',
  WRONG_ITEM: 'Wrong item received',
  ITEM_DAMAGED: 'Item damaged or defective',
  NOT_AS_DESCRIBED: 'Item not as described',
  CHANGED_MIND: 'Changed my mind',
  MULTIPLE_SIZES_TRIAL: 'Ordered multiple sizes for trial',
  RECEIVED_LATE: 'Received too late',
  QUALITY_UNSATISFACTORY: 'Product quality not satisfactory',
  UNCOMFORTABLE: 'Footwear is uncomfortable',
  COLOR_MISMATCH: "Color doesn't match the image",
  FOUND_BETTER_PRICE: 'Found a better price elsewhere',
  OTHER: 'Other'
} as const;

export const PAYMENT_METHODS = {
  COD: 'cod',
  CARD: 'card',
  UPI: 'upi',
  PAYPAL: 'paypal',
  NETBANKING: 'netbanking',
  WALLET: 'wallet'
} as const;

export const RETURN_STATUS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  COMPLETED: 'Completed'
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];
export type CancellationReason =
  (typeof CANCELLATION_REASONS)[keyof typeof CANCELLATION_REASONS];
export type ReturnReason = (typeof RETURN_REASONS)[keyof typeof RETURN_REASONS];
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];
export type ReturnStatus = (typeof RETURN_STATUS)[keyof typeof RETURN_STATUS];

// Helper functions to get arrays for Mongoose enum validation
export const getOrderStatusArray = (): OrderStatus[] => Object.values(ORDER_STATUS);
export const getPaymentStatusArray = (): PaymentStatus[] => Object.values(PAYMENT_STATUS);
export const getCancellationReasonsArray = (): CancellationReason[] =>
  Object.values(CANCELLATION_REASONS);
export const getReturnReasonsArray = (): ReturnReason[] => Object.values(RETURN_REASONS);
export const getPaymentMethodsArray = (): PaymentMethod[] => Object.values(PAYMENT_METHODS);
export const getReturnStatusArray = (): ReturnStatus[] => Object.values(RETURN_STATUS);
