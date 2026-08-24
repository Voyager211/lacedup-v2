import type { Document, Types } from 'mongoose';

/**
 * Shared document shapes for the catalog module.
 *
 * Kept separate from the model files because a module using `export =` (which
 * the models do, so their `require()` call sites stay unchanged) cannot also
 * export anything else.
 */

export interface IBrand extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  slug: string;
  image: string;
  brandOffer: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICategory extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  slug: string;
  image: string;
  categoryOffer: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductStatus = 'Available' | 'Not Available';

/** Which of the four competing offers ended up being applied. */
export type AppliedOfferType = 'none' | 'category' | 'brand' | 'product' | 'variant';

export interface IProductVariant {
  /** Assigned by Mongoose when the subdocument is saved. */
  _id?: Types.ObjectId;
  size: string;
  stock: number;
  basePrice: number;
  variantSpecificOffer: number;
  sku?: string;
}

/**
 * `brand` and `category` are ObjectIds until populated, at which point the
 * pricing methods read `.brandOffer` / `.categoryOffer` off them. The union
 * reflects both states rather than pretending only one exists.
 */
export interface IProduct extends Document {
  _id: Types.ObjectId;
  productName: string;
  slug: string;
  baseSKU?: string;
  description: string;
  brand: Types.ObjectId | IBrand;
  category: Types.ObjectId | ICategory;
  regularPrice: number;
  productOffer: number;
  variants: Types.DocumentArray<IProductVariant>;
  totalStock: number;
  quantity: number;
  sold: number;
  features: string;
  mainImage: string;
  subImages: string[];
  status: ProductStatus;
  isListed: boolean;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;

  // Real-time pricing. No final price is persisted - everything is derived from
  // the current category/brand/product/variant offers on each call.
  calculateVariantFinalPrice(variant: IProductVariant): number;
  getAverageFinalPrice(): number;
  getVariantFinalPrice(size: string): number;
  getAppliedOffer(variant: IProductVariant): number;
  getOfferType(variant: IProductVariant): AppliedOfferType;

  // Legacy aliases kept for backward compatibility
  calculateVariantSalePrice(variant: IProductVariant): number;
  getAverageSalePrice(): number;
  getVariantSalePrice(size: string): number;
}
