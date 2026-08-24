import { formatINR } from '@/lib/format';
import { discountPercent } from '@/lib/pricing';
import { cn } from '@/lib/cn';
import OfferBadges from './OfferBadges';
import type { OfferSource, Variant } from '@/types/catalog';

/**
 * One line's price, wherever money is being decided.
 *
 * The cart, the checkout summary and the order pages all show the same three
 * things - what is charged, what it was, and why - and they showed three
 * different subsets of it. This is the one rendering, so a shopper sees the
 * same arithmetic at every step from the product page to the receipt.
 *
 * Product cards deliberately do not use it: a card is being scanned, not
 * reasoned about, so it states the same numbers as plain text without badges.
 */

export interface LinePriceProps {
  regularPrice: number;
  /** What is actually charged, per unit. */
  finalPrice: number;
  /** Before the offer. Splits the saving into the offer and the rest. */
  basePrice?: number;
  offer?: { percent: number; source: OfferSource; name: string } | null;
  /** Multiplies the displayed prices. The percentages are per-unit either way. */
  quantity?: number;
  className?: string;
}

const LinePrice = ({
  regularPrice,
  finalPrice,
  basePrice,
  offer = null,
  quantity = 1,
  className
}: LinePriceProps) => {
  const total = discountPercent(regularPrice, finalPrice);
  const extra = discountPercent(regularPrice, basePrice ?? finalPrice);

  return (
    <div className={cn('text-right', className)}>
      <p className="font-semibold text-brand">{formatINR(finalPrice * quantity)}</p>

      {total > 0 && (
        <p className="text-sm text-ink-muted line-through">
          {formatINR(regularPrice * quantity)}
        </p>
      )}

      <OfferBadges
        className="mt-1 justify-end"
        offer={offer}
        extraPercent={extra}
        totalPercent={total}
      />
    </div>
  );
};

export default LinePrice;

/** Pulls the offer off a variant, or null where none applies. */
export const variantOffer = (
  variant: Variant | undefined
): { percent: number; source: OfferSource; name: string } | null =>
  variant?.offerSource && variant.offerSource !== 'none'
    ? {
        percent: variant.offerPercent ?? 0,
        source: variant.offerSource,
        name: variant.offerName ?? ''
      }
    : null;
