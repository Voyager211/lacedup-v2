/**
 * Catalog shapes, as the API actually sends them.
 *
 * Read off live responses rather than the Mongoose schema, because the
 * controllers reshape on the way out: `finalPrice` is computed per variant and
 * `averageFinalPrice` added, category and brand arrive populated but trimmed to
 * the fields the offer maths needs, and `averageSalePrice` is a legacy alias of
 * `averageFinalPrice` kept for the EJS templates.
 */

/** Which of the four competing offers won. They do not stack; the largest applies. */
export type OfferSource = 'category' | 'brand' | 'product' | 'variant' | 'none';

export interface Variant {
  _id: string;
  size: string;
  stock: number;
  basePrice: number;
  variantSpecificOffer?: number;
  sku?: string;
  /** Server-computed. Authoritative - do not recompute for anything but display. */
  finalPrice?: number;
  /** The winning offer, as a percentage off the base price. */
  offerPercent?: number;
  offerSource?: OfferSource;
  /**
   * Whose offer it is: the category or brand's own name, or the literal
   * 'Product' / 'Variant'. The badge reads from this - "20% off for all Gym
   * Sneakers" comes from the category name, not from the word "category".
   */
  offerName?: string | null;
  /**
   * regularPrice - finalPrice, and the same as a percentage.
   *
   * Measured against the regular price, not the base price: the regular price
   * is what is shown struck through, so the saving a shopper sees is the
   * distance between that and what they will pay. Both are server-computed.
   */
  totalDiscount?: number;
  totalDiscountPercent?: number;
}

export interface CategoryRef {
  _id: string;
  name: string;
  categoryOffer?: number;
  slug?: string;
  image?: string;
  description?: string;
}

export interface BrandRef {
  _id: string;
  name: string;
  brandOffer?: number;
  slug?: string;
  /**
   * `image`, not `logo`.
   *
   * The Brand schema stores it as `image` and `getActiveBrands` selects it
   * under that name. This said `logo`, so it was always undefined and the
   * landing page fell back to rendering brand names as text - which is why the
   * brand marks never appeared.
   */
  image?: string;
}

export interface Product {
  _id: string;
  productName: string;
  slug: string;
  description?: string;
  /**
   * A comma-separated string, not a list - the schema stores it as one
   * required String and the EJS page splits it at render time. Use
   * `productFeatures()` rather than treating it as an array.
   */
  features?: string;
  brand?: BrandRef | null;
  category?: CategoryRef | null;
  regularPrice: number;
  productOffer?: number;
  variants: Variant[];
  totalStock: number;
  sold?: number;
  mainImage: string;
  subImages?: string[];
  status?: string;
  isListed?: boolean;
  createdAt?: string;

  /** Added by the controllers, not stored. */
  averageFinalPrice?: number;
  averageSalePrice?: number;
  averageRating?: number;
  totalReviews?: number;
}

/**
 * Splits the stored feature string into displayable items.
 *
 * Tolerates an array because the admin form has always accepted either shape,
 * and drops blanks so a trailing comma does not render an empty bullet.
 */
export const productFeatures = (features: Product['features'] | string[]): string[] => {
  if (Array.isArray(features)) return features.filter(Boolean);
  return String(features ?? '')
    .split(',')
    .map((feature) => feature.trim())
    .filter(Boolean);
};

export interface ShopPagination {
  totalPages: number;
  totalProducts: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ShopResponse {
  success: boolean;
  products: Product[];
  pagination: ShopPagination;
  totalProductCount: number;
}

export interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  images?: string[];
  createdAt: string;
  user?: { _id?: string; name?: string; fullname?: string } | null;
}

export interface ProductDetails {
  product: Product;
  reviews: Review[];
  relatedProducts: Product[];
  averageRating: number;
  totalReviews: number;
  ratingCounts: Record<string, number>;
  ratingBreakdown: Record<string, number>;
  averageFinalPrice: number;
  isInWishlist: boolean;
  userWishlistProductIds: string[];
}

export interface FilterOptions {
  categories: CategoryRef[];
  brands: BrandRef[];
  sizes: string[];
}

export interface HomeSections {
  newArrivals: Product[];
  bestSellers: Product[];
  categories: CategoryRef[];
  brands: BrandRef[];
}

/** The query the shop page builds. Mirrors what `GET /api/shop` reads. */
export interface ShopQuery {
  page?: number;
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
  /** Comma-separated. The server accepts this or a repeated `size`. */
  sizes?: string;
  stockStatus?: string;
  sort?: string;
}
