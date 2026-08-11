import mongoose from 'mongoose';
import slugify from 'slugify';
import { generateBaseSKU, generateVariantSKU, isSkuUnique } from './sku.util';
import type {
  AppliedOfferType,
  IBrand,
  ICategory,
  IProduct,
  IProductVariant
} from './catalog.types';

const Schema = mongoose.Schema;

// Variant sub-schema for product sizes
const variantSchema = new mongoose.Schema<IProductVariant>(
  {
    size: {
      type: String,
      required: true
    },
    stock: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    basePrice: {
      type: Number,
      required: true,
      min: 0
    },
    variantSpecificOffer: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    sku: {
      type: String,
      unique: true,
      sparse: true
    }
    // Removed finalPrice field - all calculations are now real-time only
  },
  { _id: true }
);

const productSchema = new mongoose.Schema<IProduct>(
  {
    productName: {
      type: String,
      required: true
    },
    slug: {
      type: String,
      unique: true
    },
    baseSKU: {
      type: String,
      unique: true,
      sparse: true // Allows null values but ensures uniqueness when present
    },
    description: {
      type: String,
      required: true
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: true
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    regularPrice: {
      type: Number,
      required: true
    },
    productOffer: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    variants: {
      type: [variantSchema],
      default: []
    },
    totalStock: {
      type: Number,
      default: 0
    },
    quantity: {
      type: Number,
      default: 1
    },
    sold: {
      type: Number,
      default: 0
    },
    features: {
      type: String,
      required: true
    },
    mainImage: {
      type: String,
      required: true
    },
    subImages: [
      {
        type: String
      }
    ],
    status: {
      type: String,
      enum: ['Available', 'Not Available'],
      default: 'Available'
    },
    isListed: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false }
  },
  { timestamps: true }
);

/**
 * The four offers compete and the largest wins. `brand` and `category` are only
 * populated on some code paths, so these read defensively - matching the
 * original `(this.category && this.category.categoryOffer) || 0` behaviour.
 */
const offersFor = (product: IProduct, variant: IProductVariant) => {
  const category = product.category as ICategory | undefined;
  const brand = product.brand as IBrand | undefined;

  return {
    categoryOffer: category?.categoryOffer || 0,
    brandOffer: brand?.brandOffer || 0,
    productOffer: product.productOffer || 0,
    variantOffer: variant.variantSpecificOffer || 0
  };
};

// REAL-TIME PRICE CALCULATION: Always calculate based on current offers
productSchema.methods.calculateVariantFinalPrice = function (
  this: IProduct,
  variant: IProductVariant
): number {
  const { categoryOffer, brandOffer, productOffer, variantOffer } = offersFor(this, variant);
  const maxOffer = Math.max(categoryOffer, brandOffer, productOffer, variantOffer);

  // Fallback for legacy products without basePrice
  if (!variant.basePrice) {
    return this.regularPrice * (1 - maxOffer / 100);
  }

  return variant.basePrice * (1 - maxOffer / 100);
};

// REAL-TIME CALCULATION: Get average final price across all variants
productSchema.methods.getAverageFinalPrice = function (this: IProduct): number {
  if (!this.variants || this.variants.length === 0) {
    return this.regularPrice;
  }

  const totalFinalPrice = this.variants.reduce((total, variant) => {
    return total + this.calculateVariantFinalPrice(variant);
  }, 0);

  return totalFinalPrice / this.variants.length;
};

// REAL-TIME CALCULATION: Get final price for a specific variant by size
productSchema.methods.getVariantFinalPrice = function (this: IProduct, size: string): number {
  const variant = this.variants.find((v) => v.size === size);
  if (!variant) {
    return this.regularPrice;
  }
  return this.calculateVariantFinalPrice(variant);
};

// Helper method to get the applied offer percentage for a variant
productSchema.methods.getAppliedOffer = function (
  this: IProduct,
  variant: IProductVariant
): number {
  const { categoryOffer, brandOffer, productOffer, variantOffer } = offersFor(this, variant);
  return Math.max(categoryOffer, brandOffer, productOffer, variantOffer);
};

// Helper method to determine which offer type is being applied
productSchema.methods.getOfferType = function (
  this: IProduct,
  variant: IProductVariant
): AppliedOfferType {
  const { categoryOffer, brandOffer, productOffer, variantOffer } = offersFor(this, variant);

  const maxOffer = Math.max(categoryOffer, brandOffer, productOffer, variantOffer);

  if (maxOffer === 0) {
    return 'none';
  } else if (categoryOffer === maxOffer) {
    return 'category';
  } else if (brandOffer === maxOffer) {
    return 'brand';
  } else if (productOffer === maxOffer) {
    return 'product';
  } else {
    return 'variant';
  }
};

// Legacy methods for backward compatibility
productSchema.methods.calculateVariantSalePrice = function (
  this: IProduct,
  variant: IProductVariant
): number {
  return this.calculateVariantFinalPrice(variant);
};

productSchema.methods.getAverageSalePrice = function (this: IProduct): number {
  return this.getAverageFinalPrice();
};

productSchema.methods.getVariantSalePrice = function (this: IProduct, size: string): number {
  return this.getVariantFinalPrice(size);
};

// Pre-save hook: Handle slug generation, SKU generation, and stock calculation
productSchema.pre('save', async function (next) {
  try {
    // Generate slug if productName is modified
    if (this.isModified('productName')) {
      this.slug = slugify(this.productName, { lower: true, strict: true });
    }

    // Generate base SKU if it's a new product or if base SKU is missing
    if (this.isNew || !this.baseSKU) {
      // Validate required fields for SKU generation
      if (!this.brand || !this.productName) {
        return next(new Error('Brand and product name are required for SKU generation'));
      }

      // Generate base SKU
      let baseSKU = await generateBaseSKU(this.brand, this.productName);

      // Ensure base SKU is unique
      let counter = 1;
      while (!(await isSkuUnique(baseSKU, mongoose.model('Product'), this._id))) {
        baseSKU = `${await generateBaseSKU(this.brand, this.productName)}-${counter}`;
        counter++;
        if (counter > 100) {
          return next(new Error('Unable to generate unique base SKU after 100 attempts'));
        }
      }

      this.baseSKU = baseSKU;
    }

    // Generate variant SKUs for any variants that don't have them (new product or modified variants)
    if (this.variants && this.variants.length > 0) {
      // Validate required fields for SKU generation
      if (!this.brand || !this.productName) {
        return next(new Error('Brand and product name are required for SKU generation'));
      }

      for (const variant of this.variants) {
        // Check if variant SKU is missing, empty, or null
        if (!variant.sku || variant.sku.trim() === '') {
          let variantSKU = await generateVariantSKU(this.brand, this.productName, variant.size);

          // Ensure variant SKU is unique
          let variantCounter = 1;
          while (!(await isSkuUnique(variantSKU, mongoose.model('Product'), this._id))) {
            const basePart = await generateBaseSKU(this.brand, this.productName);
            const variantCode = variant.size.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            variantSKU = `${basePart}-${variantCode}-${variantCounter}`;
            variantCounter++;
            if (variantCounter > 100) {
              return next(
                new Error(`Unable to generate unique variant SKU for size ${variant.size}`)
              );
            }
          }

          variant.sku = variantSKU;
        }
      }
    }

    // Validate that all variant base prices are less than regular price
    if (this.variants && this.variants.length > 0 && this.regularPrice) {
      const regularPrice = this.regularPrice;
      if (regularPrice > 0) {
        for (let i = 0; i < this.variants.length; i++) {
          const variant = this.variants[i]!;
          if (variant.basePrice && variant.basePrice >= regularPrice) {
            const error = new Error(
              `Variant ${i + 1} (${variant.size}): Base price (₹${Math.round(variant.basePrice)}) must be less than regular price (₹${Math.round(regularPrice)})`
            );
            error.name = 'ValidationError';
            return next(error);
          }
        }
      }
    }

    // Calculate total stock from all variants
    if (this.variants && this.variants.length > 0) {
      this.totalStock = this.variants.reduce((total, variant) => {
        return total + (variant.stock || 0);
      }, 0);
    } else {
      this.totalStock = 0;
    }

    next();
  } catch (error) {
    console.error('SKU Generation Error:', error);
    next(error as Error);
  }
});

export = mongoose.model<IProduct>('Product', productSchema);
