import Product from './product.model';
import Category from './category.model';
import Brand from './brand.model';
import { withPricing } from './pricing.util';

export interface HomepageProducts {
  newArrivals: Record<string, any>[];
  bestSellers: Record<string, any>[];
}

/**
 * The `match` on the populate means products in a deactivated category come
 * back with `category === null`, which is why both lists are filtered
 * afterwards rather than relying on the query alone.
 *
 * The lists go out priced. They did not before - no per-variant final price and
 * no averageFinalPrice - so the landing page's cards fell back to the regular
 * price and quietly showed every product at full price while the shop page
 * showed the same product discounted.
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
    // The brand carries an offer too, and pricing needs its name for the badge.
    // Without this the brand is a bare id, its offer reads as 0, and the same
    // product is priced differently here and on the shop page.
    .populate({
      path: 'brand',
      match: { isActive: true, isDeleted: false },
      select: 'name brandOffer'
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
    // The brand carries an offer too, and pricing needs its name for the badge.
    // Without this the brand is a bare id, its offer reads as 0, and the same
    // product is priced differently here and on the shop page.
    .populate({
      path: 'brand',
      match: { isActive: true, isDeleted: false },
      select: 'name brandOffer'
    })
    .sort({ sold: -1 })
    .limit(4);

  return {
    newArrivals: newArrivals.filter((p) => p.category && p.brand).map((p) => withPricing(p)),
    bestSellers: bestSellers.filter((p) => p.category && p.brand).map((p) => withPricing(p))
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
