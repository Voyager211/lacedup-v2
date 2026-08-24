import type { IBrand, ICategory, IProduct, IProductVariant } from './catalog.types';

/**
 * What the storefront needs to know about a variant's price.
 *
 * The arithmetic already lived on the product model - calculateVariantFinalPrice
 * and getOfferType have been there all along - but almost none of it reached the
 * client. `/api/shop` sent a bare `finalPrice` per variant, `/api/product/:slug`
 * sent no per-variant price at all, and neither sent which offer won or what the
 * saving came to. The client was left to either recompute it (which is how the
 * displayed price drifts from the charged one) or not show it.
 *
 * This is the one place that answers, so every endpoint says the same thing.
 *
 * Note which price the discount is measured against: `regularPrice`, not
 * `basePrice`. Those are different fields - the regular price is what is shown
 * struck through, the base price is where the offer is applied from - and the
 * saving a shopper sees is the distance between the struck-through price and
 * what they will actually pay.
 */

export type OfferSource = 'category' | 'brand' | 'product' | 'variant' | 'none';

export interface VariantPricing {
  basePrice: number;
  finalPrice: number;
  /** The winning offer. Offers do not stack; the largest applies. */
  offerPercent: number;
  offerSource: OfferSource;
  /**
   * Who the offer belongs to: the category or brand's own name, or the literal
   * 'Product' / 'Variant' where the offer is on the product itself. It is what
   * the badge says - "20% off for all Gym Sneakers" reads from the category
   * name, not from the word "category".
   */
  offerName: string | null;
  /** regularPrice - finalPrice, so it includes the base-price reduction. */
  totalDiscount: number;
  totalDiscountPercent: number;
}

const percentOff = (regularPrice: number, price: number): number => {
  if (!Number.isFinite(regularPrice) || regularPrice <= 0) return 0;
  if (!Number.isFinite(price) || price >= regularPrice) return 0;
  return ((regularPrice - price) / regularPrice) * 100;
};

const nameFor = (product: IProduct, source: OfferSource): string | null => {
  switch (source) {
    case 'category':
      return (product.category as ICategory | undefined)?.name ?? 'Category';
    case 'brand':
      return (product.brand as IBrand | undefined)?.name ?? 'Brand';
    case 'product':
      return 'Product';
    case 'variant':
      return 'Variant';
    default:
      return null;
  }
};

/** The full price picture for one variant. */
export const priceVariant = (product: IProduct, variant: IProductVariant): VariantPricing => {
  const basePrice = variant.basePrice || product.regularPrice;
  const finalPrice = product.calculateVariantFinalPrice(variant);
  const offerSource = product.getOfferType(variant) as OfferSource;

  return {
    basePrice,
    finalPrice,
    offerPercent: product.getAppliedOffer(variant),
    offerSource,
    offerName: nameFor(product, offerSource),
    totalDiscount: Math.max(0, product.regularPrice - finalPrice),
    totalDiscountPercent: percentOff(product.regularPrice, finalPrice)
  };
};

/**
 * A product as a plain object with every variant priced.
 *
 * `averageFinalPrice` stays on the response because the product cards read it
 * and it is what the old UI showed. The averages the detail page needs are
 * derived on the client from the per-variant figures below, so there is one
 * definition of "the average" rather than two that can disagree.
 */
export const withPricing = (product: IProduct): Record<string, any> => {
  const plain: Record<string, any> = product.toObject();

  if (Array.isArray(plain.variants) && plain.variants.length > 0) {
    plain.variants = plain.variants.map((variant: IProductVariant) => ({
      ...variant,
      ...priceVariant(product, variant)
    }));

    plain.averageFinalPrice = product.getAverageFinalPrice();
  } else {
    plain.averageFinalPrice = plain.regularPrice;
  }

  // The old name for it. Still read by templates that have not been converted.
  plain.averageSalePrice = plain.averageFinalPrice;

  return plain;
};
