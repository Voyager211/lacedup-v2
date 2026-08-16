import { Link } from 'react-router-dom';
import { BsHeart } from 'react-icons/bs';
import { useGetWishlistQuery } from './wishlist.api';
import ProductCard from '@/features/catalog/ProductCard';
import EmptyState from '@/components/EmptyState';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonGrid } from '@/components/Skeleton';

/**
 * The wishlist.
 *
 * Reuses <ProductCard> rather than the separate card markup the EJS page had -
 * the two drifted, and the wishlist copy did not show ratings.
 *
 * No search. A wishlist is a short list somebody assembled by hand, and it is
 * all on one screen; the endpoint still takes a `q`, so putting the field back
 * is only markup if the lists ever get long.
 */
const WishlistPage = () => {
  const { data, isLoading, isFetching, error, refetch } = useGetWishlistQuery();

  // Removing lives on the card now, alongside the add-to-cart it sits next to.
  const products = data?.products ?? [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="font-heading text-3xl font-semibold text-ink">Your wishlist</h1>
      </header>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={products.length === 0}
        skeleton={<SkeletonGrid count={8} />}
        empty={
          <EmptyState
            icon={<BsHeart className="size-14" />}
            title="Your wishlist is empty"
            message="Save something you like and it will wait for you here."
            action={
              <Link
                to="/shop"
                className="rounded-md bg-brand px-5 py-2.5 font-medium text-white hover:bg-brand-hover"
              >
                Browse the shop
              </Link>
            }
          />
        }
        onRetry={refetch}
      >
        <div
          className={
            isFetching
              ? 'grid grid-cols-2 gap-4 opacity-60 md:grid-cols-3 lg:grid-cols-4'
              : 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
          }
        >
          {products.map((item) => (
            /* onWishlist gives the card its size picker and turns its heart
               into a remove - see ProductCard. */
            <ProductCard key={item._id} product={item} onWishlist />
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
};

export default WishlistPage;
