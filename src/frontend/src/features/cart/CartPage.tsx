import { Link, useNavigate } from 'react-router-dom';
import { BsBag, BsHeart, BsTrash } from 'react-icons/bs';
import {
  useClearCartMutation,
  useGetCartQuery,
  useRemoveFromCartMutation,
  useRemoveOutOfStockMutation,
  useSaveForLaterMutation,
  useUpdateCartQuantityMutation,
  type CartItem
} from './cart.api';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonText } from '@/components/Skeleton';
import { useConfirm } from '@/components/confirm/useConfirm';
import { useToast } from '@/components/toast';
import { formatINR } from '@/lib/format';
import LinePrice, { variantOffer } from '@/features/catalog/LinePrice';
import { cn } from '@/lib/cn';

/**
 * The cart.
 *
 * `cart.ejs` had no inline script at all - the behaviour was 1,282 lines in
 * public/js/user/cart.js. Most of it was DOM bookkeeping: recalculating
 * totals, re-rendering rows after a quantity change, keeping the navbar badge
 * in sync through a global. All of that is a re-render and a cache
 * invalidation here.
 *
 * The three buckets are the server's, not the client's. It partitions the cart
 * into buyable, out-of-stock and no-longer-sold, and re-prices anything whose
 * offer moved since it was added - which is why the totals below are summed
 * from the server's numbers rather than computed from a stored price.
 */

const MAX_PER_VARIANT = 5;

const CartRow = ({
  item,
  disabled,
  onQuantityChange,
  onRemove,
  onSaveForLater
}: {
  item: CartItem;
  disabled: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  onSaveForLater: () => void;
}) => {
  const product = item.productId;
  const unbuyable = item.isOutOfStock || item.isUnavailable;

  // Matched by id where the server sent one, by size otherwise - older cart
  // rows predate variantId being stored.
  const variant = product?.variants?.find(
    (candidate) => candidate._id === item.variantId || candidate.size === item.size
  );

  return (
    <li
      className={cn(
        'flex gap-4 border-b border-line py-5 last:border-0',
        unbuyable && 'opacity-70'
      )}
    >
      <Link to={`/product/${product?.slug}`} className="shrink-0">
        <img
          src={product?.mainImage}
          alt=""
          loading="lazy"
          className="size-24 rounded-md object-cover sm:size-28"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-medium text-ink">
              <Link to={`/product/${product?.slug}`} className="hover:text-brand">
                {product?.productName}
              </Link>
            </h3>
            {item.size && <p className="mt-0.5 text-sm text-ink-muted">Size {item.size}</p>}

            {item.isUnavailable && (
              <p className="mt-1 text-sm font-medium text-danger">
                {item.unavailableReason ?? 'No longer available'}
              </p>
            )}
            {item.isOutOfStock && (
              <p className="mt-1 text-sm font-medium text-warning">Out of stock</p>
            )}
          </div>

          {/* The variant is known here, so the line can say exactly which
              offer produced this price rather than just naming a total. */}
          <LinePrice
            className="shrink-0"
            regularPrice={product?.regularPrice ?? item.price}
            finalPrice={item.price}
            basePrice={variant?.basePrice}
            offer={variantOffer(variant)}
            quantity={item.quantity}
          />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3">
          {!unbuyable && (
            <div className="flex items-center rounded-md border border-line">
              <button
                type="button"
                onClick={() => onQuantityChange(item.quantity - 1)}
                disabled={disabled || item.quantity <= 1}
                aria-label="Decrease quantity"
                className="px-3 py-1.5 text-ink disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-8 text-center text-sm" aria-live="polite">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => onQuantityChange(item.quantity + 1)}
                // The server caps a variant at 5; stopping here avoids a
                // request that can only be refused.
                disabled={disabled || item.quantity >= MAX_PER_VARIANT}
                aria-label="Increase quantity"
                className="px-3 py-1.5 text-ink disabled:opacity-40"
              >
                +
              </button>
            </div>
          )}

          {!item.isUnavailable && (
            <button
              type="button"
              onClick={onSaveForLater}
              disabled={disabled}
              className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-brand disabled:opacity-50"
            >
              <BsHeart className="size-4" aria-hidden="true" />
              Save for later
            </button>
          )}

          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-danger disabled:opacity-50"
          >
            <BsTrash className="size-4" aria-hidden="true" />
            Remove
          </button>
        </div>
      </div>
    </li>
  );
};

const CartPage = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const { data, isLoading, error, refetch } = useGetCartQuery();
  const [updateQuantity, { isLoading: isUpdating }] = useUpdateCartQuantityMutation();
  const [removeItem, { isLoading: isRemoving }] = useRemoveFromCartMutation();
  const [clearCart] = useClearCartMutation();
  const [removeOutOfStock] = useRemoveOutOfStockMutation();
  const [saveForLater] = useSaveForLaterMutation();

  const busy = isUpdating || isRemoving;

  const available = data?.availableCartItems ?? [];
  const outOfStock = data?.outOfStockCartItems ?? [];
  const unavailable = data?.unavailableCartItems ?? [];
  const items = data?.cartItems ?? [];

  // Only buyable items count towards the total - the other two buckets cannot
  // be checked out and must not inflate what the shopper expects to pay.
  const subtotal = available.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemCount = available.reduce((sum, item) => sum + item.quantity, 0);
  const blocked = outOfStock.length + unavailable.length;

  const run = async (action: () => Promise<{ success?: boolean; message?: string }>, success?: string) => {
    try {
      const result = await action();
      if (success) toast.success(success);
      else if (result?.message) toast.success(result.message);
    } catch (caught) {
      toast.fromError(caught, 'That did not work.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 font-heading text-3xl font-semibold text-ink">Your cart</h1>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={items.length === 0}
        skeleton={<SkeletonText lines={6} />}
        empty={
          <EmptyState
            icon={<BsBag className="size-14" />}
            title="Your cart is empty"
            message="Once you add something, it will show up here."
            action={
              <Link
                to="/shop"
                className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
              >
                Start shopping
              </Link>
            }
          />
        }
        onRetry={refetch}
      >
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1">
            {blocked > 0 && (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
                <p className="text-sm text-ink">
                  {blocked} {blocked === 1 ? 'item is' : 'items are'} no longer available and
                  cannot be checked out.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    run(() => removeOutOfStock().unwrap(), 'Unavailable items removed')
                  }
                >
                  Remove them
                </Button>
              </div>
            )}

            <ul>
              {items.map((item) => (
                <CartRow
                  key={`${item.productId?._id}-${item.variantId ?? 'novariant'}`}
                  item={item}
                  disabled={busy}
                  onQuantityChange={(quantity) =>
                    run(() =>
                      updateQuantity({
                        productId: item.productId._id,
                        variantId: item.variantId ?? '',
                        quantity
                      }).unwrap()
                    )
                  }
                  onRemove={() =>
                    run(
                      () =>
                        removeItem({
                          productId: item.productId._id,
                          ...(item.variantId ? { variantId: item.variantId } : {})
                        }).unwrap(),
                      'Removed from your cart'
                    )
                  }
                  onSaveForLater={() =>
                    run(
                      () =>
                        saveForLater({
                          productId: item.productId._id,
                          ...(item.variantId ? { variantId: item.variantId } : {})
                        }).unwrap(),
                      'Moved to your wishlist'
                    )
                  }
                />
              ))}
            </ul>

            <button
              type="button"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Empty your cart?',
                  message: 'Everything in it will be removed.',
                  confirmLabel: 'Empty cart',
                  tone: 'danger'
                });
                if (ok) await run(() => clearCart().unwrap(), 'Cart emptied');
              }}
              className="mt-6 text-sm text-ink-muted hover:text-danger"
            >
              Empty cart
            </button>
          </div>

          <aside className="w-full shrink-0 lg:w-80">
            <div className="rounded-lg border border-line bg-white p-5">
              <h2 className="font-heading text-lg font-semibold text-ink">Summary</h2>

              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-muted">
                    Items ({itemCount})
                  </dt>
                  <dd className="text-ink">{formatINR(subtotal)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex justify-between border-t border-line pt-4">
                <span className="font-medium text-ink">Subtotal</span>
                <span className="font-semibold text-ink">{formatINR(subtotal)}</span>
              </div>

              <p className="mt-2 text-xs text-ink-muted">
                Discounts, delivery and any coupon are applied at checkout.
              </p>

              <Button
                className="mt-5"
                fullWidth
                size="lg"
                disabled={available.length === 0}
                onClick={() => navigate('/checkout')}
              >
                {available.length === 0 ? 'Nothing to check out' : 'Checkout'}
              </Button>
            </div>
          </aside>
        </div>
      </QueryBoundary>
    </div>
  );
};

export default CartPage;
