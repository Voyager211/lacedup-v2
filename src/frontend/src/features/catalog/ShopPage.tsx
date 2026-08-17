import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BsX } from 'react-icons/bs';
import { Filter, Search, X } from 'lucide-react';
import { useGetFilterOptionsQuery, useGetProductsQuery } from './catalog.api';
import ProductCard from './ProductCard';
import Button from '@/components/Button';
import EmptyState from '@/components/EmptyState';
import PageTitleBar from '@/components/PageTitleBar';
import Pagination from '@/components/Pagination';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonGrid } from '@/components/Skeleton';
import { cn } from '@/lib/cn';
import type { ShopQuery } from '@/types/catalog';

/**
 * The shop listing.
 *
 * Filter state lives in the URL rather than component state. The EJS page kept
 * a `currentFilters` object in JS and pushed nothing to the address bar, so a
 * filtered view could not be linked, bookmarked, or reached with the back
 * button. Reading from useSearchParams gives all three for free, makes RTK
 * Query's cache key fall out of the URL, and is what keeps search, filters and
 * paging consistent with each other - they are all the same object.
 */

/**
 * These values must match the `sortMap` keys in shop.controller.ts.
 *
 * An unrecognised value is not an error there - it falls through to `newest`,
 * so a wrong key produces a sort control that silently does nothing. Three of
 * these were wrong on the first pass for exactly that reason.
 */
export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popularity', label: 'Most popular' },
  { value: 'rating', label: 'Best rated' },
  { value: 'priceLow', label: 'Price: low to high' },
  { value: 'priceHigh', label: 'Price: high to low' },
  { value: 'nameAZ', label: 'Name: A to Z' },
  { value: 'nameZA', label: 'Name: Z to A' }
] as const;

const FIELD = 'w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink';

const ShopPage = () => {
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const query = useMemo<ShopQuery>(
    () => ({
      page: Number(params.get('page')) || 1,
      q: params.get('q') ?? '',
      category: params.get('category') ?? '',
      brand: params.get('brand') ?? '',
      minPrice: params.get('minPrice') ?? '',
      maxPrice: params.get('maxPrice') ?? '',
      sizes: params.get('sizes') ?? '',
      stockStatus: params.get('stockStatus') ?? '',
      sort: params.get('sort') ?? 'newest'
    }),
    [params]
  );

  const { data, isFetching, error, refetch } = useGetProductsQuery(query);
  const { data: filters } = useGetFilterOptionsQuery();

  /** Writes one filter and resets to page 1 - page 4 of a new filter is meaningless. */
  const setFilter = (key: keyof ShopQuery, value: string) => {
    const next = new URLSearchParams(params);

    if (value) next.set(key, value);
    else next.delete(key);

    if (key !== 'page') next.delete('page');

    setParams(next);
  };

  /*
   * The search box is typed into, so it holds its own value and pushes it to
   * the URL after a pause. Writing on every keystroke would put a history entry
   * behind every letter and fire a request for each one.
   */
  const [search, setSearch] = useState(query.q ?? '');

  useEffect(() => setSearch(query.q ?? ''), [query.q]);

  useEffect(() => {
    if (search === (query.q ?? '')) return undefined;

    const timer = setTimeout(() => setFilter('q', search.trim()), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFilter closes over params
  }, [search]);

  const toggleSize = (size: string) => {
    const current = (query.sizes ? String(query.sizes).split(',') : []).filter(Boolean);
    const next = current.includes(size)
      ? current.filter((s) => s !== size)
      : [...current, size];

    setFilter('sizes', next.join(','));
  };

  const selectedSizes = (query.sizes ? String(query.sizes).split(',') : []).filter(Boolean);

  const activeFilters = [
    query.q && { key: 'q' as const, label: `"${query.q}"` },
    query.category && {
      key: 'category' as const,
      label: filters?.categories.find((c) => c._id === query.category)?.name ?? 'Category'
    },
    query.brand && {
      key: 'brand' as const,
      label: filters?.brands.find((b) => b._id === query.brand)?.name ?? 'Brand'
    },
    query.minPrice && { key: 'minPrice' as const, label: `From ₹${query.minPrice}` },
    query.maxPrice && { key: 'maxPrice' as const, label: `Up to ₹${query.maxPrice}` },
    query.stockStatus === 'inStock' && { key: 'stockStatus' as const, label: 'In stock' },
    ...selectedSizes.map((size) => ({ key: 'sizes' as const, label: size, size }))
  ].filter(Boolean) as Array<{ key: keyof ShopQuery; label: string; size?: string }>;

  const products = data?.products ?? [];
  const pagination = data?.pagination;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageTitleBar
        title="Products"
        count={pagination?.totalProducts}
        leading={
          <Button
            size="sm"
            variant="outline"
            aria-expanded={filtersOpen}
            aria-controls="shop-filters"
            onClick={() => setFiltersOpen((open) => !open)}
            icon={
              filtersOpen ? (
                <X className="size-4" aria-hidden="true" />
              ) : (
                <Filter className="size-4" aria-hidden="true" />
              )
            }
          >
            {filtersOpen ? 'Hide Filters' : 'View Filters'}
          </Button>
        }
      >
        <div className="relative w-full sm:w-64">
          {/*
            Not "Search products" - that is the navbar typeahead's name, and
            two identically-named searches on one page is three controls a
            screen reader cannot tell apart. This one filters the listing in
            place; that one navigates.
          */}
          <label htmlFor="shop-search" className="sr-only">
            Search the shop
          </label>
          <input
            id="shop-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products…"
            className={cn(
              FIELD,
              'pr-9',
              // WebKit draws its own cross inside type="search"; ours is below.
              '[&::-webkit-search-cancel-button]:appearance-none'
            )}
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-muted transition-colors hover:bg-brand hover:text-white"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          ) : (
            <Search
              className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="shrink-0 text-sm font-medium text-ink">
            Sort by
          </label>
          <select
            id="sort"
            value={query.sort}
            onChange={(event) => setFilter('sort', event.target.value)}
            className={cn(FIELD, 'w-auto')}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </PageTitleBar>

      {/*
        Both columns sit below the bar and neither is inside it, so opening the
        filters cannot move it. The sidebar animates its own width and opacity;
        the grid simply reflows into the space.
      */}
      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <aside
          id="shop-filters"
          hidden={!filtersOpen}
          className={cn(
            'w-full shrink-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-out',
            'lg:w-64',
            filtersOpen ? 'max-w-full opacity-100' : 'max-w-0 opacity-0'
          )}
        >
          <div className="space-y-6 rounded-lg border border-line bg-white p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-semibold text-ink">Filters</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setFiltersOpen(false)}
                icon={<X className="size-4" aria-hidden="true" />}
              >
                Hide
              </Button>
            </div>

            <div>
              <label htmlFor="category" className="mb-2 block text-sm font-medium text-ink">
                Category
              </label>
              <select
                id="category"
                value={query.category}
                onChange={(event) => setFilter('category', event.target.value)}
                className={FIELD}
              >
                <option value="">All categories</option>
                {filters?.categories.map((category) => (
                  <option key={category._id} value={category._id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="brand" className="mb-2 block text-sm font-medium text-ink">
                Brand
              </label>
              <select
                id="brand"
                value={query.brand}
                onChange={(event) => setFilter('brand', event.target.value)}
                className={FIELD}
              >
                <option value="">All brands</option>
                {filters?.brands.map((brand) => (
                  <option key={brand._id} value={brand._id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>

            {(filters?.sizes.length ?? 0) > 0 && (
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-ink">Size</legend>
                <div className="flex flex-wrap gap-2">
                  {filters?.sizes.map((size) => {
                    const selected = selectedSizes.includes(size);
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => toggleSize(size)}
                        aria-pressed={selected}
                        className={cn(
                          'rounded-md border px-3 py-1.5 text-sm transition-colors',
                          selected
                            ? 'border-brand bg-brand text-white'
                            : 'border-line text-ink hover:border-brand hover:bg-brand hover:text-white'
                        )}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-ink">Price</legend>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Min"
                  aria-label="Minimum price"
                  defaultValue={String(query.minPrice ?? '')}
                  onBlur={(event) => setFilter('minPrice', event.target.value)}
                  className="w-full rounded-md border border-line px-2 py-1.5 text-sm"
                />
                <span className="text-ink-muted">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="Max"
                  aria-label="Maximum price"
                  defaultValue={String(query.maxPrice ?? '')}
                  onBlur={(event) => setFilter('maxPrice', event.target.value)}
                  className="w-full rounded-md border border-line px-2 py-1.5 text-sm"
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-ink">Stock status</legend>
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={query.stockStatus === 'inStock'}
                  onChange={(event) =>
                    setFilter('stockStatus', event.target.checked ? 'inStock' : '')
                  }
                  className="size-4 accent-brand"
                />
                In stock
              </label>
            </fieldset>

            {activeFilters.length > 0 && (
              <Button variant="outline" fullWidth size="sm" onClick={() => setParams({})}>
                Clear all filters
              </Button>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {activeFilters.length > 0 && (
            <ul className="mb-4 flex flex-wrap gap-2">
              {activeFilters.map((filter) => (
                <li key={`${filter.key}-${filter.label}`}>
                  <button
                    type="button"
                    onClick={() =>
                      filter.size ? toggleSize(filter.size) : setFilter(filter.key, '')
                    }
                    className="flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm text-ink transition-colors hover:bg-brand hover:text-white"
                  >
                    {filter.label}
                    <BsX className="size-4" aria-hidden="true" />
                    <span className="sr-only">Remove this filter</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <QueryBoundary
            isLoading={isFetching && products.length === 0}
            error={error}
            isEmpty={products.length === 0}
            skeleton={<SkeletonGrid count={9} />}
            empty={
              <EmptyState
                title="Nothing matched those filters"
                message="Try widening your price range or clearing a filter."
                action={
                  <Button variant="outline" onClick={() => setParams({})}>
                    Clear filters
                  </Button>
                }
              />
            }
            onRetry={refetch}
          >
            <div
              className={cn(
                'grid grid-cols-2 gap-4 md:grid-cols-3',
                filtersOpen ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
                // Dim during a refetch rather than unmounting the grid, so the
                // page does not jump back to a skeleton on every filter change.
                isFetching && 'opacity-60 transition-opacity'
              )}
            >
              {products.map((product) => (
                <ProductCard key={product._id} product={product} />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <Pagination
                className="mt-10"
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                disabled={isFetching}
                onPageChange={(page) => {
                  setFilter('page', String(page));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </QueryBoundary>
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
