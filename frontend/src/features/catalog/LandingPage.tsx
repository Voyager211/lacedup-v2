import { Link } from 'react-router-dom';
import { useGetHomeSectionsQuery } from './catalog.api';
import ProductCard from './ProductCard';
import CategoryCarousel from './CategoryCarousel';
import HeroCarousel from './HeroCarousel';
import BrandStrip from './BrandStrip';
import Testimonials from '@/features/content/Testimonials';
import CommunityJoin from '@/features/content/CommunityJoin';
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
      {/*
        Artwork only. The wordmark, the tagline and the "Shop the collection"
        button that used to sit here are gone at the owner's request - the shop
        is still one click away in the nav above, which is the only route this
        section used to offer that nothing else did.
      */}
      <HeroCarousel />

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

        {/* Between the two product rows on purpose: it is the dark band that
            separates them, and two white grids stacked read as one long list. */}
        <CategoryCarousel categories={data?.categories ?? []} />

        <Section
          title="Best sellers"
          products={data?.bestSellers ?? []}
          href="/shop?sort=popularity"
        />

        <BrandStrip brands={data?.brands ?? []} />
      </QueryBoundary>

      {/*
        Outside the boundary: these two are fixed copy and a signup form, so
        they have nothing to wait for and no reason to disappear if the product
        query fails.
      */}
      <Testimonials />
      <CommunityJoin />
    </>
  );
};

export default LandingPage;
