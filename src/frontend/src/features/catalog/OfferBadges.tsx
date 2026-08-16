import { cn } from '@/lib/cn';
import type { OfferSource } from '@/types/catalog';

/**
 * The discount badges.
 *
 * A price here can be reduced twice over, and the two reductions are not the
 * same kind of thing:
 *
 *  - the *offer* - category, brand, product or variant - takes a percentage off
 *    the variant's base price, and belongs to something a shopper can be told
 *    about ("20% off for all Gym Sneakers");
 *  - the gap between the regular price and that base price is a reduction too,
 *    but it belongs to nothing and has no name. It is the "extra".
 *
 * Showing one number for both hides that a category-wide sale is running. So:
 * the offer is stated first in green, and the unattributed remainder follows it
 * in orange. With no offer there is one green badge and one number.
 *
 * Badges are for the pages where the shopper is deciding - the detail page and
 * the money summaries. Product cards state the same arithmetic as plain text.
 */

export interface OfferBadgesProps {
  /** The winning offer. Null when nothing beats the base price. */
  offer: { percent: number; source: OfferSource; name: string } | null;
  /**
   * Regular price down to the base price, as a percent. The part of the saving
   * the offer does not account for.
   */
  extraPercent: number;
  /** The whole saving off the regular price. Shown alone when there is no offer. */
  totalPercent: number;
  className?: string;
}

const BADGE = 'rounded px-2 py-0.5 text-xs font-semibold';

/** "20% off for all Gym Sneakers!" or "20% off on this Product!" */
export const offerLabel = (offer: { percent: number; source: OfferSource; name: string }): string => {
  const percent = Math.round(offer.percent);

  return offer.source === 'category' || offer.source === 'brand'
    ? `${percent}% off for all ${offer.name} Sneakers!`
    : `${percent}% off on this ${offer.name}!`;
};

const OfferBadges = ({ offer, extraPercent, totalPercent, className }: OfferBadgesProps) => {
  const extra = Math.round(extraPercent);
  const total = Math.round(totalPercent);

  if (!offer || offer.percent <= 0) {
    if (total <= 0) return null;

    return (
      <span className={cn(BADGE, 'bg-success/10 text-success', className)}>{total}% Off</span>
    );
  }

  return (
    <span className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className={cn(BADGE, 'bg-success/10 text-success')}>{offerLabel(offer)}</span>

      {extra > 0 && (
        <>
          <span className="text-xs font-semibold text-ink-muted">+</span>
          <span className={cn(BADGE, 'bg-warning/20 text-[#8a5200]')}>Extra {extra}% off</span>
        </>
      )}
    </span>
  );
};

export default OfferBadges;
