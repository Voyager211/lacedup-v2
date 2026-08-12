import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BsHeart, BsSearch, BsX } from 'react-icons/bs';
import { useGetWishlistQuery, useRemoveFromWishlistMutation } from './wishlist.api';
import ProductCard from '@/features/catalog/ProductCard';
import EmptyState from '@/components/EmptyState';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonGrid } from '@/components/Skeleton';
import { useToast } from '@/components/toast';

/**
 * The wishlist.
 *
 * Reuses <ProductCard> rather than the separate card markup the EJS page had -
 * the two drifted, and the wishlist copy did not show ratings.
 *
 * Search is debounced against the same endpoint the page loads from. The old
 * view called a second `/wishlist/search` route that returned a different
 * shape for the same data.
 */
const WishlistPage = () => {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isFetching, error, refetch } = useGetWishlistQuery(debounced);
  const [removeFromWishlist] = useRemoveFromWishlistMutation();

  const products = data?.products ?? [];

  const remove = async (productId: string) => {
    try {
      await removeFromWishlist(productId).unwrap();
      toast.success('Removed from your wishlist');
    } catch (caught) {
      toast.fromError(caught, 'Could not remove that.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-heading text-3xl font-semibold text-ink">Your wishlist</h1>

        <div className="relative w-full max-w-xs">
          <label htmlFor="wishlist-search" className="sr-only">
            Search your wishlist
          </label>
          <BsSearch
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            id="wishlist-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your wishlist"
            className="w-full rounded-full border border-line bg-white py-2 pl-10 pr-9 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-card"
            >
              <BsX className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        isEmpty={products.length === 0}
        skeleton={<SkeletonGrid count={8} />}
        empty={
          debounced ? (
            <EmptyState
              title={`Nothing in your wishlist matches “${debounced}”`}
              message="Try a different search."
            />
          ) : (
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
          )
        }
        onRetry={refetch}
      >
        <div
          className={
            isFetching ? 'grid grid-cols-2 gap-4 opacity-60 md:grid-cols-3 lg:grid-cols-4' : 'grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4'
          }
        >
          {products.map((item) => (
            <ProductCard
              key={item._id}
              product={item}
              action={
                <button
                  type="button"
                  onClick={() => remove(item._id)}
                  aria-label={`Remove ${item.productName} from your wishlist`}
                  className="rounded-full bg-white/90 p-2 text-danger shadow-sm transition-colors hover:bg-white"
                >
                  <BsX className="size-4" aria-hidden="true" />
                </button>
              }
            />
          ))}
        </div>
      </QueryBoundary>
    </div>
  );
};

export default WishlistPage;
