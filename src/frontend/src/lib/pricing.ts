/**
 * Price display helpers.
 *
 * ⚠️ These are for DISPLAY ONLY.
 *
 * The server computes prices per request and is authoritative - it recomputes
 * on every add-to-cart, coupon apply and place-order, and a price-consistency
 * middleware rejects mismatches. Never send a client-computed price back, and
 * never cache one and assume it still holds.
 *
 * They exist because product listings ship variant offers and expect the
 * client to render a price, and because that arithmetic was previously
 * duplicated across product-card.ejs, cart-item-card.ejs and shop.ejs - three
 * copies that had already drifted.
 */

import type { OfferSource } from '@/types/catalog';

export interface OfferSources {
  categoryOffer?: number | null;
  brandOffer?: number | null;
  productOffer?: number | null;
  variantOffer?: number | null;
}

/**
 * The winning offer percentage.
 *
 * Offers do not stack: the largest of the category, brand, product and variant
 * offers applies, matching shop.controller.ts. Values outside 0-100 are
 * clamped rather than trusted - a bad offer in the database should not produce
 * a negative price on screen.
 */
export const effectiveOffer = (sources: OfferSources): number => {
  const candidates = [
    sources.categoryOffer,
    sources.brandOffer,
    sources.productOffer,
    sources.variantOffer
  ].map((value) => (typeof value === 'number' && Number.isFinite(value) ? value : 0));

  return Math.min(100, Math.max(0, ...candidates));
};

/** Base price with the winning offer applied. */
export const finalPrice = (basePrice: number, sources: OfferSources): number => {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return 0;
  return basePrice * (1 - effectiveOffer(sources) / 100);
};

/**
 * Discount off the regular price, as a whole percentage.
 *
 * Derived from the two prices rather than from the offer, because the regular
 * price and the variant base price are separate fields - the visible saving is
 * the difference between what is shown struck through and what is charged.
 */
export const discountPercent = (regularPrice: number, currentPrice: number): number => {
  if (!Number.isFinite(regularPrice) || regularPrice <= 0) return 0;
  if (!Number.isFinite(currentPrice) || currentPrice >= regularPrice) return 0;
  return Math.round(((regularPrice - currentPrice) / regularPrice) * 100);
};

/**
 * What a product costs, averaged across its variants.
 *
 * The server prices each variant - final price, winning offer, saving against
 * the regular price - and this is the product-level view of that, for the
 * states where no particular variant has been chosen: a product card, or a
 * detail page before a size is picked.
 *
 * Pure, so it can be memoised by the caller. It is not free: three passes over
 * the variants on every render of every card in a grid otherwise.
 */
export interface ProductPricing {
  regularPrice: number;
  /** Mean of the variant base prices - before any offer. */
  averageBasePrice: number;
  /** Mean of the variant final prices - after the winning offer. */
  averageFinalPrice: number;
  /** (regularPrice - averageFinalPrice) / regularPrice, as a whole percent. */
  averageDiscountPercent: number;
  /**
   * The offer, when every variant is under the same one.
   *
   * A variant-specific offer can leave the variants disagreeing, and there is
   * no honest single badge for that - so this is null and the page shows the
   * plain total discount until a size is chosen.
   */
  offer: { percent: number; source: OfferSource; name: string } | null;
}

export interface PricedProduct {
  regularPrice: number;
  variants?: Array<{
    basePrice?: number | null;
    finalPrice?: number | null;
    offerPercent?: number | null;
    offerSource?: OfferSource;
    offerName?: string | null;
  }>;
}

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

export const productPricing = (product: PricedProduct | null | undefined): ProductPricing => {
  const regularPrice = product?.regularPrice ?? 0;
  const variants = product?.variants ?? [];

  const empty: ProductPricing = {
    regularPrice,
    averageBasePrice: regularPrice,
    averageFinalPrice: regularPrice,
    averageDiscountPercent: 0,
    offer: null
  };

  if (variants.length === 0) return empty;

  const averageBasePrice = mean(variants.map((v) => v.basePrice ?? regularPrice));
  const averageFinalPrice = mean(variants.map((v) => v.finalPrice ?? v.basePrice ?? regularPrice));

  // One badge only if every variant agrees on the offer behind it.
  const first = variants[0];
  const shared =
    first?.offerSource &&
    first.offerSource !== 'none' &&
    variants.every(
      (v) => v.offerSource === first.offerSource && v.offerPercent === first.offerPercent
    );

  return {
    regularPrice,
    averageBasePrice,
    averageFinalPrice,
    averageDiscountPercent: discountPercent(regularPrice, averageFinalPrice),
    offer: shared
      ? {
          percent: first.offerPercent ?? 0,
          source: first.offerSource as OfferSource,
          name: first.offerName ?? ''
        }
      : null
  };
};

/**
 * The "from" price a product card shows when its variants differ.
 *
 * The EJS card averaged every variant's final price, which is an odd thing to
 * show a shopper - the average is a price nothing is actually sold at. This
 * returns the cheapest instead, which is what "from ₹x" means, and the range
 * so the caller can decide how to present it.
 *
 * Where the API already sends `averageFinalPrice`, prefer that for parity with
 * the current UI until the design is deliberately changed.
 */
export const priceRange = (
  variants: Array<{ basePrice?: number | null; variantSpecificOffer?: number | null }>,
  sources: Omit<OfferSources, 'variantOffer'>,
  fallbackBasePrice = 0
): { min: number; max: number; varies: boolean } => {
  const prices = variants
    .map((variant) =>
      finalPrice(variant.basePrice ?? fallbackBasePrice, {
        ...sources,
        variantOffer: variant.variantSpecificOffer ?? 0
      })
    )
    .filter((price) => price > 0);

  if (prices.length === 0) return { min: 0, max: 0, varies: false };

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max, varies: min !== max };
};
