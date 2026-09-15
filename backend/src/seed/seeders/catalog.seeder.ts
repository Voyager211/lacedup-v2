import Brand from '../../modules/catalog/brand.model';
import Category from '../../modules/catalog/category.model';
import Product from '../../modules/catalog/product.model';
import {
  BRANDS,
  CATEGORIES,
  PRODUCTS,
  baseSku,
  brandId,
  categoryId,
  productId,
  slugOf,
  variantId,
  variantSku
} from '../data/catalog';
import { daysBefore } from '../data/people';
import { seedWorld } from '../data/world';
import { insertMissing, type Seeder } from '../runner';

export const catalogSeeder: Seeder = {
  name: 'catalog',
  models: [Category, Brand, Product],
  run: async ({ log }) => {
    const { now } = seedWorld();

    const categories = await insertMissing(
      Category,
      CATEGORIES.map((category) => ({
        _id: categoryId(category.key),
        name: category.name,
        slug: slugOf(category.name),
        description: category.description,
        image: category.image,
        categoryOffer: category.offer,
        isActive: true,
        isDeleted: false,
        createdAt: daysBefore(now, 175)
      }))
    );

    const brands = await insertMissing(
      Brand,
      BRANDS.map((brand) => ({
        _id: brandId(brand.key),
        name: brand.name,
        slug: slugOf(brand.name),
        description: brand.description,
        image: brand.image,
        brandOffer: brand.offer,
        isActive: true,
        isDeleted: false,
        createdAt: daysBefore(now, 175)
      }))
    );

    // Slugs, SKUs and totalStock are what the pre-save hook would derive.
    const products = await insertMissing(
      Product,
      PRODUCTS.map((product) => ({
        _id: productId(product.key),
        productName: product.name,
        slug: slugOf(product.name),
        baseSKU: baseSku(product),
        description: product.description,
        brand: brandId(product.brand),
        category: categoryId(product.category),
        regularPrice: product.regularPrice,
        productOffer: product.offer,
        variants: product.variants.map((variant) => ({
          _id: variantId(product.key, variant.size),
          size: variant.size,
          stock: variant.stock,
          basePrice: variant.basePrice,
          variantSpecificOffer: variant.offer,
          sku: variantSku(product, variant.size)
        })),
        totalStock: product.variants.reduce((sum, variant) => sum + variant.stock, 0),
        sold: product.sold,
        features: product.features,
        mainImage: product.images[0],
        subImages: product.images.slice(1),
        status: 'Available',
        isListed: product.isListed,
        isDeleted: false,
        createdAt: daysBefore(now, product.daysAgo)
      }))
    );

    log(`${categories} categories, ${brands} brands, ${products} products inserted`);
  }
};
