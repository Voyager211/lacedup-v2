// Helper functions for comprehensive cart validation

/**
 * These accept loosely-shaped objects rather than the strict document types:
 * callers pass a mix of hydrated documents, `.lean()` results and populated
 * subsets, and the checks are all defensive presence tests.
 */
export interface ValidatableVariant {
  _id: unknown;
  size?: string;
  stock?: number;
}

export interface ValidatableProduct {
  productName?: string;
  isListed?: boolean;
  isDeleted?: boolean;
  category?: { isActive?: boolean; isDeleted?: boolean } | null;
  brand?: { isActive?: boolean; isDeleted?: boolean } | null;
  variants?: ValidatableVariant[];
}

export interface ValidatableCartItem {
  productId?: ValidatableProduct | null;
  variantId?: unknown;
  size?: string;
  quantity?: number;
}

export interface AvailabilityResult {
  isValid: boolean;
  reason: string | null;
}

export interface CartItemValidationDetails {
  productName: string;
  size?: string;
  quantity?: number;
  availableStock?: number;
}

export interface CartItemValidationResult {
  isValid: boolean;
  reason: string | null;
  details: CartItemValidationDetails | null;
}

/** Validates whether a product is available for purchase. */
export const validateProductAvailability = (
  product: ValidatableProduct | null | undefined
): AvailabilityResult => {
  // Check product availability
  if (!product || !product.isListed || product.isDeleted) {
    return { isValid: false, reason: 'Product is no longer available' };
  }

  // Check category availability - uses isActive rather than isListed for categories
  if (product.category && (product.category.isActive === false || product.category.isDeleted === true)) {
    return { isValid: false, reason: 'Product category is no longer available' };
  }

  // Check brand availability
  if (product.brand && (product.brand.isActive === false || product.brand.isDeleted === true)) {
    return { isValid: false, reason: 'Product brand is no longer available' };
  }

  return { isValid: true, reason: null };
};

/** Validates whether a cart item is still purchasable. */
export const validateCartItem = (item: ValidatableCartItem): CartItemValidationResult => {
  const productValidation = validateProductAvailability(item.productId);

  if (!productValidation.isValid) {
    return {
      isValid: false,
      reason: productValidation.reason,
      details: {
        productName: item.productId ? (item.productId.productName ?? 'Unknown Product') : 'Unknown Product',
        size: item.size,
        quantity: item.quantity
      }
    };
  }

  const product = item.productId!;

  // Check variant availability if applicable
  if (item.variantId) {
    const variant = (product.variants ?? []).find(
      (v) => String(v._id) === String(item.variantId)
    );

    if (!variant) {
      return {
        isValid: false,
        reason: 'Product variant is no longer available',
        details: {
          productName: product.productName ?? 'Unknown Product',
          size: item.size,
          quantity: item.quantity
        }
      };
    }

    // Check variant stock
    if (variant.stock === 0) {
      return {
        isValid: false,
        reason: `Size ${item.size} is currently out of stock`,
        details: {
          productName: product.productName ?? 'Unknown Product',
          size: item.size,
          quantity: item.quantity,
          availableStock: 0
        }
      };
    }

    // Check if cart quantity exceeds available stock
    if (item.quantity !== undefined && variant.stock !== undefined && item.quantity > variant.stock) {
      return {
        isValid: false,
        reason: `Only ${variant.stock} items available in stock for size ${item.size}. You have ${item.quantity} in your cart.`,
        details: {
          productName: product.productName ?? 'Unknown Product',
          size: item.size,
          quantity: item.quantity,
          availableStock: variant.stock
        }
      };
    }
  }

  return { isValid: true, reason: null, details: null };
};

/**
 * Standard populate query for cart items with comprehensive data.
 * Uses isActive for categories rather than isListed.
 */
export const getCartPopulateQuery = () => {
  return {
    path: 'items.productId',
    populate: [
      {
        path: 'category',
        select: 'name isActive isDeleted categoryOffer'
      },
      {
        path: 'brand',
        select: 'name isActive isDeleted brandOffer'
      }
    ]
  };
};
