import { describe, expect, it } from 'vitest';
import { discountPercent, effectiveOffer, finalPrice, priceRange } from './pricing';

describe('effectiveOffer', () => {
  it('takes the largest offer - they do not stack', () => {
    expect(
      effectiveOffer({ categoryOffer: 10, brandOffer: 25, productOffer: 5, variantOffer: 15 })
    ).toBe(25);
  });

  it('treats missing and null offers as zero', () => {
    expect(effectiveOffer({ categoryOffer: null, productOffer: 30 })).toBe(30);
    expect(effectiveOffer({})).toBe(0);
  });

  it('clamps a bad offer instead of trusting it', () => {
    // A 150% offer in the database must not produce a negative price on screen.
    expect(effectiveOffer({ productOffer: 150 })).toBe(100);
    expect(effectiveOffer({ productOffer: -20 })).toBe(0);
  });

  it('ignores non-finite values', () => {
    expect(effectiveOffer({ productOffer: NaN, brandOffer: 12 })).toBe(12);
  });
});

describe('finalPrice', () => {
  it('applies the winning offer', () => {
    expect(finalPrice(2000, { categoryOffer: 10, brandOffer: 25 })).toBe(1500);
  });

  it('returns the base price when there is no offer', () => {
    expect(finalPrice(2000, {})).toBe(2000);
  });

  it('never returns a negative price', () => {
    expect(finalPrice(2000, { productOffer: 200 })).toBe(0);
  });

  it('handles a missing or nonsensical base price', () => {
    expect(finalPrice(0, { productOffer: 10 })).toBe(0);
    expect(finalPrice(NaN, {})).toBe(0);
  });
});

describe('discountPercent', () => {
  it('derives the saving from the two prices', () => {
    expect(discountPercent(2000, 1500)).toBe(25);
  });

  it('rounds to a whole percentage', () => {
    expect(discountPercent(2999, 1999)).toBe(33);
  });

  it('reports nothing when the price is not actually lower', () => {
    expect(discountPercent(2000, 2000)).toBe(0);
    expect(discountPercent(2000, 2500)).toBe(0);
  });

  it('guards against a zero regular price', () => {
    expect(discountPercent(0, 1500)).toBe(0);
  });
});

describe('priceRange', () => {
  const sources = { categoryOffer: 10, brandOffer: 0, productOffer: 0 };

  it('reports the cheapest and dearest variant', () => {
    const range = priceRange(
      [
        { basePrice: 2000, variantSpecificOffer: 0 },
        { basePrice: 3000, variantSpecificOffer: 0 }
      ],
      sources
    );

    expect(range).toEqual({ min: 1800, max: 2700, varies: true });
  });

  it('applies each variant own offer where it beats the others', () => {
    const range = priceRange(
      [
        { basePrice: 2000, variantSpecificOffer: 50 },
        { basePrice: 2000, variantSpecificOffer: 0 }
      ],
      sources
    );

    expect(range).toEqual({ min: 1000, max: 1800, varies: true });
  });

  it('flags a single effective price as not varying', () => {
    const range = priceRange([{ basePrice: 2000 }, { basePrice: 2000 }], sources);
    expect(range.varies).toBe(false);
  });

  it('falls back to the product base price when a variant has none', () => {
    const range = priceRange([{ basePrice: null }], sources, 2000);
    expect(range.min).toBe(1800);
  });

  it('copes with a product that has no variants', () => {
    expect(priceRange([], sources)).toEqual({ min: 0, max: 0, varies: false });
  });
});
