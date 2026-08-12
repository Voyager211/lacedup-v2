import { Link } from 'react-router-dom';
import { useGetHomeSectionsQuery } from './catalog.api';
import ProductCard from './ProductCard';
import QueryBoundary from '@/components/QueryBoundary';
import { SkeletonGrid } from '@/components/Skeleton';
import type { Product } from '@/types/catalog';

/**
 * The landing page.
 *
 * `/` and `/home` rendered near-identical EJS views - the only difference was
 * that /home carried an auth guard - so this is one component and /home
 * redirects here.
 *
 * Everything comes from one request. The EJS controller ran three queries and
 * passed the results as render locals; `/api/home-sections` reuses those same
 * helpers, so the two cannot disagree about what is new.
 */

const Section = ({
  title,
  products,
  href
}: {
  title: string;
  products: Product[];
  href: string;
}) => {
  if (products.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="font-heading text-2xl font-semibold text-ink">{title}</h2>
        <Link to={href} className="text-sm font-medium text-brand hover:underline">
          View all
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {products.slice(0, 8).map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </section>
  );
};

const LandingPage = () => {
  const { data, isLoading, error, refetch } = useGetHomeSectionsQuery();

  return (
    <>
      <section className="bg-ink text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <h1 className="font-display text-5xl leading-none tracking-wide sm:text-7xl">
            WHERE STYLE MEETS
            <br />
            STREET CULTURE
          </h1>
          <p className="mx-auto mt-5 max-w-lg text-white/70">
            Sneakers picked for the way you actually wear them.
          </p>
          <Link
            to="/shop"
            className="mt-8 inline-block rounded-md bg-brand px-8 py-3 font-medium text-white transition-colors hover:bg-brand-hover"
          >
            Shop the collection
          </Link>
        </div>
      </section>

      <QueryBoundary
        isLoading={isLoading}
        error={error}
        skeleton={
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <SkeletonGrid count={8} />
          </div>
        }
        onRetry={refetch}
      >
        <Section title="New arrivals" products={data?.newArrivals ?? []} href="/shop?sort=newest" />
        <Section
          title="Best sellers"
          products={data?.bestSellers ?? []}
          href="/shop?sort=popularity"
        />

        {(data?.categories.length ?? 0) > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h2 className="mb-6 font-heading text-2xl font-semibold text-ink">Shop by category</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {data?.categories.map((category) => (
                <Link
                  key={category._id}
                  to={`/shop?category=${category._id}`}
                  className="group relative aspect-[4/3] overflow-hidden rounded-lg bg-card"
                >
                  {category.image && (
                    <img
                      src={category.image}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  )}
                  <span className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 to-transparent p-4 font-heading text-lg font-semibold text-white">
                    {category.name}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {(data?.brands.length ?? 0) > 0 && (
          <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
            <h2 className="mb-6 font-heading text-2xl font-semibold text-ink">Shop by brand</h2>
            <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {data?.brands.map((brand) => (
                <Link
                  key={brand._id}
                  to={`/shop?brand=${brand._id}`}
                  className="flex aspect-video items-center justify-center rounded-lg border border-line bg-white p-4 transition-colors hover:border-brand"
                >
                  {brand.logo ? (
                    <img
                      src={brand.logo}
                      alt={brand.name}
                      loading="lazy"
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-sm font-medium text-ink">{brand.name}</span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </QueryBoundary>
    </>
  );
};

export default LandingPage;
