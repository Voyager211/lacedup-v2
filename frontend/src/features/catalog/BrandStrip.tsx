import { Link } from 'react-router-dom';
import SectionHeading from '@/components/SectionHeading';
import type { BrandRef } from '@/types/catalog';

/**
 * Shop by brands.
 *
 * The marks are the point - a shopper looking for Adidas scans for the three
 * stripes, not for the word. They never rendered before: the client read
 * `brand.logo` while the schema stores `image`, so every card fell through to
 * its text fallback. See BrandRef.
 *
 * The server only returns brands that have an image, so the fallback here is
 * for the gap between an image being cleared and the list refreshing, not for
 * the normal case.
 */
const BrandStrip = ({ brands }: { brands: BrandRef[] }) => {
  if (brands.length === 0) return null;

  return (
    <section className="bg-linear-to-b from-white to-card/40 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading underline subtitle="Discover your favorite brands">
          Shop by Brands
        </SectionHeading>

        <ul className="mt-10 grid grid-cols-3 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {brands.map((brand) => (
            <li key={brand._id}>
              <Link
                to={`/shop?brand=${brand._id}`}
                title={brand.name}
                className="flex aspect-square items-center justify-center rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
              >
                {brand.image ? (
                  <img
                    src={brand.image}
                    alt={brand.name}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-center text-sm font-semibold text-ink">{brand.name}</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default BrandStrip;
