import { Link } from 'react-router-dom';
import { BsStarFill } from 'react-icons/bs';
import { formatINR } from '@/lib/format';
import { discountPercent } from '@/lib/pricing';
import { cn } from '@/lib/cn';
import type { Product } from '@/types/catalog';

/**
 * The product card.
 *
 * Used by the landing, shop, wishlist and related-products sections - the same
 * four places the EJS partial was, so the price and discount arithmetic lives
 * in one component instead of being recomputed in each template.
 *
 * The price shown is `averageFinalPrice`, which the server computes. The old
 * card recomputed it in the template from the variant offers, which meant the
 * displayed price could disagree with the one the cart charged.
 */
export interface ProductCardProps {
  product: Product;
  /** Rendered top-right - the wishlist toggle, once step 5 lands. */
  action?: React.ReactNode;
  className?: string;
}

const ProductCard = ({ product, action, className }: ProductCardProps) => {
  const price = Math.round(product.averageFinalPrice ?? product.regularPrice);
  const discount = discountPercent(product.regularPrice, price);
  const soldOut = product.totalStock === 0;

  return (
    <article
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-lg border border-line bg-white',
        'transition-shadow hover:shadow-md',
        className
      )}
    >
      <Link to={`/product/${product.slug}`} className="relative block aspect-square overflow-hidden">
        <img
          src={product.mainImage}
          alt={product.productName}
          loading="lazy"
          className={cn(
            'size-full object-cover transition-transform duration-300 group-hover:scale-105',
            soldOut && 'opacity-60'
          )}
        />

        {soldOut && (
          <span className="absolute left-0 top-4 bg-danger px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
            Sold out
          </span>
        )}

        {!soldOut && discount > 0 && (
          <span className="absolute left-3 top-3 rounded bg-ink px-2 py-1 text-xs font-semibold text-white">
            {discount}% off
          </span>
        )}
      </Link>

      {action && <div className="absolute right-3 top-3">{action}</div>}

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

        <div className="mt-auto flex items-baseline gap-2 pt-3">
          <span className="font-semibold text-ink">{formatINR(price)}</span>
          {discount > 0 && (
            <span className="text-sm text-ink-muted line-through">
              {formatINR(product.regularPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
};

export default ProductCard;
