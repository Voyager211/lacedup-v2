import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BsHeart, BsHeartFill, BsStarFill, BsStar } from 'react-icons/bs';
import { useGetProductQuery } from './catalog.api';
import ProductCard from './ProductCard';
import Button from '@/components/Button';
import QueryBoundary from '@/components/QueryBoundary';
import { Skeleton } from '@/components/Skeleton';
import { useToast } from '@/components/toast';
import { useAddToCartMutation } from '@/features/cart/cart.api';
import {
  useAddToWishlistMutation,
  useRemoveFromWishlistMutation
} from '@/features/wishlist/wishlist.api';
import { useAppSelector } from '@/app/store';
import { selectSession } from '@/features/auth/authSlice';
import { formatDate, formatINR } from '@/lib/format';
import { discountPercent } from '@/lib/pricing';
import { cn } from '@/lib/cn';
import { productFeatures } from '@/types/catalog';
import type { Variant } from '@/types/catalog';
import { Home, LayoutGrid, Package, Store } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';

/**
 * The product page.
 *
 * The EJS view was 2,550 lines, 1,368 of them inline script. Most of that was
 * imperative DOM work - swapping gallery images, recomputing the price when a
 * size was picked, toggling stock messages - which is state and a render here.
 *
 * Prices come from the server. Each variant carries a `finalPrice` computed
 * from the largest applicable offer; the old page recalculated it in the
 * browser, which is how the displayed price could disagree with the charged one.
 */

const Stars = ({ rating, className }: { rating: number; className?: string }) => (
  <span className={cn('inline-flex items-center gap-0.5', className)} aria-hidden="true">
    {[1, 2, 3, 4, 5].map((star) =>
      star <= Math.round(rating) ? (
        <BsStarFill key={star} className="size-4 text-warning" />
      ) : (
        <BsStar key={star} className="size-4 text-line" />
      )
    )}
  </span>
);

const ProductDetailsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const { data, isLoading, error, refetch } = useGetProductQuery(slug ?? '', { skip: !slug });
  const { status: sessionStatus } = useAppSelector(selectSession('user'));

  const [addToCartMutation, { isLoading: isAdding }] = useAddToCartMutation();
  const [addToWishlist] = useAddToWishlistMutation();
  const [removeFromWishlist] = useRemoveFromWishlistMutation();

  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [imageIndex, setImageIndex] = useState(0);

  const product = data?.product;

  const images = useMemo(
    () => [product?.mainImage, ...(product?.subImages ?? [])].filter(Boolean) as string[],
    [product]
  );

  const features = useMemo(() => productFeatures(product?.features), [product]);

  // Default to the first variant that is actually buyable, so the page does
  // not open on a size nobody can order.
  const selectedVariant: Variant | undefined = useMemo(() => {
    if (!product?.variants?.length) return undefined;
    if (selectedVariantId) {
      return product.variants.find((variant) => variant._id === selectedVariantId);
    }
    return product.variants.find((variant) => variant.stock > 0) ?? product.variants[0];
  }, [product, selectedVariantId]);

  const price = Math.round(
    selectedVariant?.finalPrice ?? product?.averageFinalPrice ?? product?.regularPrice ?? 0
  );
  const discount = discountPercent(product?.regularPrice ?? 0, price);
  const inStock = (selectedVariant?.stock ?? 0) > 0;

  /**
   * Both actions require a session. Checking first sends the visitor to login
   * with somewhere to come back to, rather than letting the request 401 and
   * the interceptor bounce them with no memory of what they were doing.
   */
  const requireSignIn = (): boolean => {
    if (sessionStatus === 'authenticated') return false;

    toast.info('Sign in to continue');
    navigate('/login', { state: { from: { pathname: `/product/${slug}` } } });
    return true;
  };

  const addToCart = async () => {
    if (requireSignIn() || !product || !selectedVariant) return;

    try {
      await addToCartMutation({
        productId: product._id,
        variantId: selectedVariant._id
      }).unwrap();

      toast.success('Added to your cart', `${product.productName} · Size ${selectedVariant.size}`);
    } catch (caught) {
      // The server distinguishes OUT_OF_STOCK, INSUFFICIENT_STOCK and
      // CART_QUANTITY_LIMIT, and its message names the size and the number
      // available - more useful than anything invented here.
      toast.fromError(caught, 'Could not add that to your cart.');
    }
  };

  const toggleWishlist = async () => {
    if (requireSignIn() || !product) return;

    try {
      if (data?.isInWishlist) {
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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={
          <div className="grid gap-10 lg:grid-cols-2">
            <Skeleton className="aspect-square w-full" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-10 w-1/4" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        }
        onRetry={refetch}
      >
        {product && (
          <>
            <Breadcrumbs
              className="mb-6"
              items={[
                { label: 'Home', to: '/', icon: Home },
                { label: 'Shop', to: '/shop', icon: Store },
                ...(product.category?.name
                  ? [
                      {
                        label: product.category.name,
                        to: `/shop?category=${product.category._id}`,
                        icon: LayoutGrid
                      }
                    ]
                  : []),
                { label: product.productName, icon: Package }
              ]}
            />

            <div className="grid gap-10 lg:grid-cols-2">
              <div>
                <div className="overflow-hidden rounded-lg border border-line bg-white">
                  <img
                    src={images[imageIndex]}
                    alt={product.productName}
                    className="aspect-square w-full object-cover"
                  />
                </div>

                {images.length > 1 && (
                  <div className="mt-3 flex gap-3">
                    {images.map((image, index) => (
                      <button
                        key={image}
                        type="button"
                        onClick={() => setImageIndex(index)}
                        aria-label={`View image ${index + 1}`}
                        aria-current={index === imageIndex}
                        className={cn(
                          'size-20 overflow-hidden rounded-md border-2 transition-colors',
                          index === imageIndex ? 'border-brand' : 'border-line hover:border-ink'
                        )}
                      >
                        <img src={image} alt="" className="size-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {product.brand?.name && (
                  <Link
                    to={`/shop?brand=${product.brand._id}`}
                    className="text-sm font-medium text-ink-muted hover:text-brand"
                  >
                    {product.brand.name}
                  </Link>
                )}

                <h1 className="mt-1 font-heading text-3xl font-semibold text-ink">
                  {product.productName}
                </h1>

                {data.totalReviews > 0 && (
                  <p className="mt-3 flex items-center gap-2">
                    <Stars rating={data.averageRating} />
                    <span className="text-sm text-ink-muted">
                      {data.averageRating.toFixed(1)} · {data.totalReviews}{' '}
                      {data.totalReviews === 1 ? 'review' : 'reviews'}
                    </span>
                  </p>
                )}

                <div className="mt-5 flex items-baseline gap-3">
                  <span className="text-3xl font-semibold text-ink">{formatINR(price)}</span>
                  {discount > 0 && (
                    <>
                      <span className="text-lg text-ink-muted line-through">
                        {formatINR(product.regularPrice)}
                      </span>
                      <span className="rounded bg-success/10 px-2 py-0.5 text-sm font-semibold text-success">
                        {discount}% off
                      </span>
                    </>
                  )}
                </div>

                {product.variants.length > 0 && (
                  <fieldset className="mt-6">
                    <legend className="mb-2 text-sm font-medium text-ink">Size</legend>
                    <div className="flex flex-wrap gap-2">
                      {product.variants.map((variant) => {
                        const soldOut = variant.stock === 0;
                        const selected = variant._id === selectedVariant?._id;

                        return (
                          <button
                            key={variant._id}
                            type="button"
                            disabled={soldOut}
                            onClick={() => setSelectedVariantId(variant._id)}
                            aria-pressed={selected}
                            className={cn(
                              'min-w-16 rounded-md border px-4 py-2 text-sm transition-colors',
                              selected && 'border-ink bg-ink text-white',
                              !selected && !soldOut && 'border-line text-ink hover:border-ink',
                              soldOut &&
                                'cursor-not-allowed border-line text-ink-muted/50 line-through'
                            )}
                          >
                            {variant.size}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                <p className="mt-4 text-sm" aria-live="polite">
                  {inStock ? (
                    (selectedVariant?.stock ?? 0) <= 5 ? (
                      <span className="font-medium text-warning">
                        Only {selectedVariant?.stock} left in this size
                      </span>
                    ) : (
                      <span className="text-success">In stock</span>
                    )
                  ) : (
                    <span className="font-medium text-danger">Out of stock in this size</span>
                  )}
                </p>

                <div className="mt-6 flex gap-3">
                  <Button
                    size="lg"
                    fullWidth
                    disabled={!inStock}
                    loading={isAdding}
                    onClick={addToCart}
                  >
                    {inStock ? 'Add to cart' : 'Out of stock'}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    aria-label={
                      data.isInWishlist ? 'Remove from your wishlist' : 'Save to your wishlist'
                    }
                    onClick={toggleWishlist}
                    icon={
                      data.isInWishlist ? (
                        <BsHeartFill className="size-5 text-brand" aria-hidden="true" />
                      ) : (
                        <BsHeart className="size-5" aria-hidden="true" />
                      )
                    }
                  />
                </div>

                {product.description && (
                  <section className="mt-8 border-t border-line pt-6">
                    <h2 className="font-heading text-lg font-semibold text-ink">Description</h2>
                    <p className="mt-2 whitespace-pre-line text-ink-muted">{product.description}</p>
                  </section>
                )}

                {features.length > 0 && (
                  <section className="mt-6">
                    <h2 className="font-heading text-lg font-semibold text-ink">Features</h2>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-ink-muted">
                      {features.map((feature) => <li key={feature}>{feature}</li>)}
                    </ul>
                  </section>
                )}
              </div>
            </div>

            <section className="mt-16 border-t border-line pt-10">
              <h2 className="font-heading text-2xl font-semibold text-ink">
                Reviews {data.totalReviews > 0 && `(${data.totalReviews})`}
              </h2>

              {data.reviews.length === 0 ? (
                <p className="mt-4 text-ink-muted">No reviews yet.</p>
              ) : (
                <ul className="mt-6 space-y-6">
                  {data.reviews.map((review) => (
                    <li key={review._id} className="border-b border-line pb-6 last:border-0">
                      <div className="flex items-center gap-3">
                        <Stars rating={review.rating} />
                        <span className="text-sm font-medium text-ink">
                          {review.user?.name ?? review.user?.fullname ?? 'A shopper'}
                        </span>
                        <span className="text-sm text-ink-muted">
                          {formatDate(review.createdAt)}
                        </span>
                      </div>

                      {review.title && <p className="mt-2 font-medium text-ink">{review.title}</p>}
                      {review.comment && <p className="mt-1 text-ink-muted">{review.comment}</p>}

                      {(review.images?.length ?? 0) > 0 && (
                        <div className="mt-3 flex gap-2">
                          {review.images?.map((image) => (
                            <img
                              key={image}
                              src={image}
                              alt=""
                              loading="lazy"
                              className="size-20 rounded-md object-cover"
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data.relatedProducts.length > 0 && (
              <section className="mt-16 border-t border-line pt-10">
                <h2 className="mb-6 font-heading text-2xl font-semibold text-ink">
                  You might also like
                </h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {data.relatedProducts.map((related) => (
                    <ProductCard key={related._id} product={related} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
};

export default ProductDetailsPage;
