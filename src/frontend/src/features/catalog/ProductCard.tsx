import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BsStarFill } from 'react-icons/bs';
import { Heart, HeartOff, ShoppingCart } from 'lucide-react';
import { formatINR } from '@/lib/format';
import { productPricing } from '@/lib/pricing';
import { cn } from '@/lib/cn';
import { useAppSelector } from '@/app/store';
import { selectSession } from '@/features/auth/authSlice';
import { useToast } from '@/components/toast';
import { useAddToCartMutation } from '@/features/cart/cart.api';
import {
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation
} from '@/features/wishlist/wishlist.api';
import type { Product } from '@/types/catalog';

/**
 * The product card.
 *
 * Used by the landing, shop, wishlist and related-product grids - the same four
 * places the EJS partial was, so the price arithmetic and the two actions live
 * in one component rather than being rebuilt per page.
 *
 * Prices are the averages across variants, derived from the server's per-variant
 * figures. Plain text, never badges: a card is a list entry being scanned, and
 * the badge treatment belongs to the pages where a purchase is being decided.
 *
 * On the wishlist the card grows a size picker, because that page's whole job is
 * moving something into the cart and the cart needs a variant. Everywhere else
 * the cart button opens the product, where sizes are chosen properly.
 */

export interface ProductCardProps {
  product: Product;
  /**
   * Turns the card into the wishlist variant: a size dropdown, an add-to-cart
   * that uses it, and a wishlist button that removes rather than adds.
   */
  onWishlist?: boolean;
  className?: string;
}

const ICON_BUTTON = cn(
  'flex size-9 items-center justify-center rounded-md border transition-colors',
  'disabled:pointer-events-none disabled:opacity-50'
);

const ProductCard = ({ product, onWishlist = false, className }: ProductCardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const { status: sessionStatus } = useAppSelector(selectSession('user'));
  const [addToCart, { isLoading: isAdding }] = useAddToCartMutation();
  const [addToWishlist] = useAddToWishlistMutation();
  const [removeFromWishlist] = useRemoveFromWishlistMutation();

  const [variantId, setVariantId] = useState('');
  const [sizeError, setSizeError] = useState(false);

  const pricing = useMemo(() => productPricing(product), [product]);

  const price = Math.round(pricing.averageFinalPrice);
  const discount = pricing.averageDiscountPercent;
  const soldOut = product.totalStock === 0;

  /**
   * Both actions need a session. Checking here sends the visitor to login with
   * somewhere to come back to, rather than letting the request 401 and the
   * interceptor bounce them with no memory of what they were doing.
   */
  const requireSignIn = (): boolean => {
    if (sessionStatus === 'authenticated') return false;

    toast.info('Sign in to continue');
    navigate('/login', { state: { from: { pathname: location.pathname + location.search } } });
    return true;
  };

  const onCart = async () => {
    if (requireSignIn()) return;

    // Off the wishlist there is no size picker, so the product page is where
    // this goes - adding an arbitrary variant on the shopper's behalf is worse
    // than asking.
    if (!onWishlist) {
      navigate(`/product/${product.slug}`);
      return;
    }

    if (!variantId) {
      setSizeError(true);
      return;
    }

    try {
      await addToCart({ productId: product._id, variantId }).unwrap();
      toast.success('Added to your cart', product.productName);
    } catch (caught) {
      toast.fromError(caught, 'Could not add that to your cart.');
    }
  };

  const onWishlistToggle = async () => {
    if (requireSignIn()) return;

    try {
      if (onWishlist) {
        await removeFromWishlist(product._id).unwrap();
        toast.success('Removed from your wishlist');
      } else {
        await addToWishlist(product._id).unwrap();
        toast.success('Saved to your wishlist');
      }
    } catch (caught) {
      toast.fromError(caught, 'Could not update your wishlist.');
    }
  };

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border bg-white',
        // The card lifts as a whole rather than zooming its photograph: the
        // image staying put is what makes the card feel like the thing being
        // picked up. Transform and shadow are both compositor-only.
        'border-line transition-[transform,box-shadow,border-color] duration-200 ease-out',
        'hover:-translate-y-1 hover:border-brand hover:shadow-lg',
        className
      )}
    >
      {/*
        Hidden from assistive tech and from the tab order: it goes to the same
        place as the title below it, so exposing both means every card is two
        identical links to read past.
      */}
      <Link
        to={`/product/${product.slug}`}
        aria-hidden="true"
        tabIndex={-1}
        className="relative block aspect-square overflow-hidden"
      >
        <img
          src={product.mainImage}
          alt=""
          loading="lazy"
          className={cn('size-full object-cover', soldOut && 'opacity-60')}
        />

        {soldOut && (
          <span className="absolute left-0 top-4 bg-danger px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="line-clamp-2 font-medium text-ink">
          <Link to={`/product/${product.slug}`} className="hover:text-brand">
            {product.productName}
          </Link>
        </h3>

        {product.brand?.name && (
          <p className="mt-0.5 text-sm text-ink-muted">{product.brand.name}</p>
        )}

        {(product.totalReviews ?? 0) > 0 && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-ink-muted">
            <BsStarFill className="size-3.5 text-warning" aria-hidden="true" />
            <span>{(product.averageRating ?? 0).toFixed(1)}</span>
            <span className="text-xs">({product.totalReviews})</span>
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-1">
          <span className="font-semibold text-brand">{formatINR(price)}</span>
          {discount > 0 && (
            <>
              <span className="text-sm text-ink-muted line-through">
                {formatINR(product.regularPrice)}
              </span>
              <span className="text-sm font-semibold text-success">{discount}% off</span>
            </>
          )}
        </div>

        {onWishlist && (
          <div className="mt-3">
            <div className="flex min-h-5 items-baseline gap-2">
              <label htmlFor={`size-${product._id}`} className="text-sm text-ink-muted">
                Size:
              </label>

              {/*
                The message sits on the label's own line rather than under the
                select. Below it, appearing would grow the card and shove the
                grid around - which is the one thing an error must not do.
              */}
              {sizeError && (
                <span role="alert" className="animate-shake text-sm font-medium text-brand">
                  Select Size First!
                </span>
              )}
            </div>

            <select
              id={`size-${product._id}`}
              value={variantId}
              onChange={(event) => {
                setVariantId(event.target.value);
                setSizeError(false);
              }}
              className={cn(
                'mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm text-ink',
                sizeError ? 'border-brand' : 'border-line'
              )}
            >
              <option value="">Select Size</option>
              {product.variants?.map((variant) => (
                <option key={variant._id} value={variant._id} disabled={variant.stock === 0}>
                  {variant.size}
                  {variant.stock === 0
                    ? ' (Out of stock)'
                    : variant.stock <= 5
                      ? ` (Only ${variant.stock} left)`
                      : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onWishlistToggle}
            aria-label={
              onWishlist
                ? `Remove ${product.productName} from your wishlist`
                : `Save ${product.productName} to your wishlist`
            }
            title={onWishlist ? 'Remove from wishlist' : 'Save to wishlist'}
            className={cn(
              ICON_BUTTON,
              onWishlist
                ? 'border-brand bg-brand text-white hover:bg-brand-hover'
                : 'border-line text-ink-muted hover:border-brand hover:text-brand'
            )}
          >
            {onWishlist ? (
              <HeartOff className="size-4" aria-hidden="true" />
            ) : (
              <Heart className="size-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onCart}
            disabled={soldOut || isAdding}
            aria-label={`Add ${product.productName} to your cart`}
            title={soldOut ? 'Sold out' : 'Add to cart'}
            className={cn(ICON_BUTTON, 'border-ink bg-ink text-white hover:bg-ink/90')}
          >
            <ShoppingCart className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
