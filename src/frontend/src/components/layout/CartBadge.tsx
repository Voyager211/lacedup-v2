import { Link } from 'react-router-dom';
import { BsCart } from 'react-icons/bs';
import { useGetCartCountQuery } from '@/features/cart/cart.api';

/**
 * Cart icon with a live count.
 *
 * The navbar partial polled `/cart/count` on a 30-second setInterval that was
 * never cleared, plus on visibilitychange, and exposed
 * `window.updateNavbarCartCount` for four other scripts to call after
 * mutating the cart.
 *
 * RTK Query does the same job declaratively: the poll is torn down with the
 * component, refetchOnFocus replaces the visibilitychange listener, and cart
 * mutations invalidate the CartCount tag instead of reaching for a global.
 */
const CartBadge = ({ enabled }: { enabled: boolean }) => {
  const { data: count = 0 } = useGetCartCountQuery(undefined, {
    skip: !enabled,
    pollingInterval: 30_000,
    refetchOnFocus: true
  });

  return (
    <Link
      to="/cart"
      className="relative rounded-full p-2 text-white transition-colors hover:bg-white/10"
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
    >
      <BsCart className="size-5" aria-hidden="true" />

      {count > 0 && (
        <span
          // aria-hidden because the count is already in the link's label -
          // otherwise a screen reader announces the number twice.
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-brand text-[0.625rem] font-semibold text-white"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  );
};

export default CartBadge;
