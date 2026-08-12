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
