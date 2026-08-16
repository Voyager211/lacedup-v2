import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SectionHeading from '@/components/SectionHeading';
import { cn } from '@/lib/cn';
import type { CategoryRef } from '@/types/catalog';

/**
 * Shop by category, as a full-bleed carousel on black.
 *
 * Built on a scrolling track rather than a transform: the browser already
 * knows how to flick, drag and snap one, so touch and trackpad work without
 * any of it being written here, and the arrows are then just `scrollBy`. The
 * previous grid could show four categories; this shows however many there are
 * and makes the next one visible at the edge, which is what invites the scroll.
 *
 * The arrows disable themselves at each end rather than looping. A carousel
 * that wraps silently hides where the list stops.
 */

const CategoryCarousel = ({ categories }: { categories: CategoryRef[] }) => {
  const trackRef = useRef<HTMLUListElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;

    // A pixel of tolerance: fractional scroll widths mean scrollLeft rarely
    // lands exactly on the end.
    setAtStart(track.scrollLeft <= 1);
    setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 1);
  }, []);

  useEffect(() => {
    sync();

    const track = trackRef.current;
    if (!track) return undefined;

    // The end also moves when the viewport does, not only when scrolling.
    // ResizeObserver watches the track itself, which catches a sidebar opening
    // as well as the window changing - but it is absent in jsdom and in older
    // browsers, so fall back to the window rather than throwing on mount.
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', sync);
      return () => window.removeEventListener('resize', sync);
    }

    const observer = new ResizeObserver(sync);
    observer.observe(track);
    return () => observer.disconnect();
  }, [sync, categories.length]);

  const scrollByCard = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;

    const card = track.querySelector('li');
    const step = card ? card.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * step, behavior: 'smooth' });
  };

  if (categories.length === 0) return null;

  return (
    <section className="bg-ink py-16 sm:py-20">
      <SectionHeading onDark className="px-4">
        Shop by Category
      </SectionHeading>

      <div className="relative mt-10">
        <ul
          ref={trackRef}
          onScroll={sync}
          className={cn(
            // The wide gutter is where the arrows sit, so they are beside the
            // cards rather than on top of the artwork.
            'flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth px-4 pb-2 sm:px-20',
            // Snapping ignores padding without this: the first card snaps flush
            // to the edge on load and the gutter the arrows live in disappears.
            'scroll-px-4 sm:scroll-px-20',
            // The native bar would sit under the cards on a dark ground and
            // read as a seam; the arrows and the drag both still work.
            '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
          {categories.map((category) => (
            /* Sized so three sit in the track with the next one showing at the
               edge - the sliver is what says the row keeps going. */
            <li key={category._id} className="w-[19rem] shrink-0 snap-start sm:w-[24rem]">
              <Link
                to={`/shop?category=${category._id}`}
                className="group relative block aspect-[10/9] overflow-hidden rounded-xl bg-white/5"
              >
                {category.image && (
                  <img
                    src={category.image}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}

                {/* Dark enough for white text over any photograph. */}
                <span className="absolute inset-0 bg-black/35 transition-colors group-hover:bg-black/45" />

                <span className="absolute inset-0 flex items-center justify-center px-8 text-center font-heading text-2xl font-bold uppercase tracking-[0.12em] text-white drop-shadow sm:text-3xl">
                  {category.name}
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => scrollByCard(-1)}
          disabled={atStart}
          aria-label="Previous categories"
          className={cn(
            'absolute left-5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-3 text-ink shadow-lg',
            'transition hover:bg-white/90 disabled:pointer-events-none disabled:opacity-0 sm:block'
          )}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={() => scrollByCard(1)}
          disabled={atEnd}
          aria-label="More categories"
          className={cn(
            'absolute right-5 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white p-3 text-ink shadow-lg',
            'transition hover:bg-white/90 disabled:pointer-events-none disabled:opacity-0 sm:block'
          )}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
};

export default CategoryCarousel;
