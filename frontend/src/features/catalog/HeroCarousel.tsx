import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { cloudinarySrcSet, cloudinaryUrl } from '@/lib/cloudinary';

/**
 * The landing hero: artwork only, no copy over it.
 *
 * Built on a scrolling track with snap points rather than a transform, the
 * same way CategoryCarousel is - the browser already knows how to drag, flick
 * and snap one, so touch and trackpad work without any of it being written
 * here, and moving a slide is `scrollTo` rather than bookkeeping about
 * position. It also degrades honestly: with JavaScript slow to arrive the
 * first slide is already painted and the rest are one swipe away.
 *
 * The slides carry no visible copy, so the artwork itself is decorative and
 * takes `alt=""` - inventing descriptions for it would add noise to a screen
 * reader and say nothing a shopper can act on. The arrows and dots are hidden
 * from assistive tech for the same reason: they move artwork around and lead
 * nowhere on their own.
 *
 * A slide can link somewhere, though none currently does. The second slide did
 * while it was a photograph of the Court Vision Low; the artwork that replaced
 * it shows running shoes that are not in the catalogue at all, and pointing
 * that at the court shoe would land a shopper on something they did not click.
 * The mechanism stays because the destination is the only missing part: set
 * `href` and `label` on a slide and it becomes a link, named for screen
 * readers rather than by rendering words.
 */

interface Slide {
  url: string;
  /** Where the slide goes when clicked. Omit for artwork that leads nowhere. */
  href?: string;
  /**
   * The link's accessible name.
   *
   * Required whenever `href` is set: the artwork is decorative and carries
   * `alt=""`, so without this the link has nothing to announce and a screen
   * reader reads out the URL. It is not rendered, which keeps the hero free of
   * visible copy.
   */
  label?: string;
}

/**
 * The slides, and why they are simply cropped to the box.
 *
 * Both sources are wider than 16:9 - 1.79 and 2.02 - so filling the box takes
 * the difference off the left and right, where both of these have nothing but
 * sky. Measured on the wider one: the 6% trimmed from each side averages half
 * the brightness of the middle, which is the empty night behind the shoes.
 *
 * This was briefly padding rather than cropping, because a previous second
 * slide was 1.49 - taller than the box - and cropping it cut the shoe off at
 * the bottom. That image is gone, and padding the ones that replaced it would
 * be worse than the problem: this one's top edge is navy, so the bars would
 * read as a band rather than disappear.
 */
const SLIDES: readonly Slide[] = [
  {
    url: 'https://res.cloudinary.com/daqfxkc3u/image/upload/v1770014043/Gemini_Generated_Image_opandhopandhopan_bvewuv.jpg'
  },
  {
    url: 'https://res.cloudinary.com/daqfxkc3u/image/upload/v1789224705/08c2a8cf3a4628c43c12989d63902086_hrowbn.jpg'
  }
];

/** How long a slide holds before advancing. */
const INTERVAL_MS = 6000;

const HeroCarousel = () => {
  const trackRef = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  /**
   * Which slide is showing, read back from the scroll position.
   *
   * The track is the source of truth rather than `index`, because a drag moves
   * it without going through any handler here - deriving the dot from the
   * scroll keeps the two in step however the slide was reached.
   */
  const syncIndex = useCallback(() => {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;

    setIndex(Math.round(track.scrollLeft / track.clientWidth));
  }, []);

  const goTo = useCallback((next: number) => {
    const track = trackRef.current;
    if (!track) return;

    // Wraps deliberately: with two slides, an arrow that disabled itself at
    // each end would be greyed out half the time.
    const target = (next + SLIDES.length) % SLIDES.length;
    track.scrollTo({ left: target * track.clientWidth, behavior: 'smooth' });
  }, []);

  /**
   * Auto-advance, and the three cases where it should not.
   *
   * Paused while a pointer is over it or focus is inside, so it cannot move
   * out from under someone looking at it; and off entirely under
   * prefers-reduced-motion, where the arrows and swipe still work but nothing
   * animates on its own.
   */
  useEffect(() => {
    if (paused || SLIDES.length < 2) return undefined;

    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduced) return undefined;

    const timer = window.setInterval(() => goTo(index + 1), INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [index, paused, goTo]);

  return (
    <section
      aria-label="Featured"
      className="relative isolate bg-ink"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <ul
        ref={trackRef}
        onScroll={syncIndex}
        className={cn(
          'flex snap-x snap-mandatory overflow-x-auto scroll-smooth',
          // The bar would cut across the artwork; dragging and the arrows both
          // still work without it.
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
        )}
      >
        {SLIDES.map((slide, position) => {
          const image = (
            <img
              src={cloudinaryUrl(slide.url, { width: 1920 })}
              srcSet={cloudinarySrcSet(slide.url)}
              sizes="100vw"
              alt=""
              // The first slide is the largest thing above the fold; the rest
              // can wait until they are scrolled to.
              loading={position === 0 ? 'eager' : 'lazy'}
              fetchPriority={position === 0 ? 'high' : 'auto'}
              className="size-full object-cover"
            />
          );

          return (
            <li key={slide.url} className="w-full shrink-0 snap-start">
              {/* Cropped to fill; both sources are wider than this. */}
              <div className="aspect-[16/9] w-full">
                {slide.href ? (
                  <Link to={slide.href} aria-label={slide.label} className="block size-full">
                    {image}
                  </Link>
                ) : (
                  image
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {SLIDES.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-hidden="true"
            tabIndex={-1}
            className={cn(
              'absolute left-5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink shadow-lg',
              'transition hover:bg-white sm:block'
            )}
          >
            <ChevronLeft className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-hidden="true"
            tabIndex={-1}
            className={cn(
              'absolute right-5 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-3 text-ink shadow-lg',
              'transition hover:bg-white sm:block'
            )}
          >
            <ChevronRight className="size-5" />
          </button>

          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-4 flex justify-center gap-2"
          >
            {SLIDES.map((slide, position) => (
              <button
                key={slide.url}
                type="button"
                tabIndex={-1}
                onClick={() => goTo(position)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  position === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
};

export default HeroCarousel;
