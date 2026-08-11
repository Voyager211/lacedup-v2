import Product from './product.model';
import Category from './category.model';
import Brand from './brand.model';
import type { IProduct } from './catalog.types';

export interface HomepageProducts {
  newArrivals: IProduct[];
  bestSellers: IProduct[];
}

/**
 * The `match` on the populate means products in a deactivated category come
 * back with `category === null`, which is why both lists are filtered
 * afterwards rather than relying on the query alone.
 */
export async function getHomepageProducts(): Promise<HomepageProducts> {
  const newArrivals = await Product.find({
    isDeleted: false,
    isListed: true,
    totalStock: { $gt: 0 }
  })
    .populate({
      path: 'category',
      match: { isActive: true }
    })
    .sort({ createdAt: -1 })
    .limit(4);

  const bestSellers = await Product.find({
    isDeleted: false,
    isListed: true,
    totalStock: { $gt: 0 }
  })
    .populate({
      path: 'category',
      match: { isActive: true }
    })
    .sort({ sold: -1 })
    .limit(4);

  return {
    newArrivals: newArrivals.filter((p) => p.category),
    bestSellers: bestSellers.filter((p) => p.category)
  };
}

export async function getActiveCategories() {
  return await Category.find({
    isActive: true,
    isDeleted: false
  })
    .sort({ name: 1 })
    .select('name slug image description');
}

export async function getActiveBrands() {
  return await Brand.find({
    isActive: true,
    isDeleted: false,
    image: { $exists: true, $ne: null } // Only brands with images
  })
    .sort({ name: 1 })
    .select('_id name slug image');
}
