/**
 * Catalog shapes, as the API actually sends them.
 *
 * Read off live responses rather than the Mongoose schema, because the
 * controllers reshape on the way out: `finalPrice` is computed per variant and
 * `averageFinalPrice` added, category and brand arrive populated but trimmed to
 * the fields the offer maths needs, and `averageSalePrice` is a legacy alias of
 * `averageFinalPrice` kept for the EJS templates.
 */

export interface Variant {
  _id: string;
  size: string;
  stock: number;
  basePrice: number;
  variantSpecificOffer?: number;
  sku?: string;
  /** Server-computed. Authoritative - do not recompute for anything but display. */
  finalPrice?: number;
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
  logo?: string;
}

export interface Product {
  _id: string;
  productName: string;
  slug: string;
  description?: string;
  features?: string[];
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
  sizes?: string;
  stockStatus?: string;
  sort?: string;
}
