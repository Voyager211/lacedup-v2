import { useCallback, useEffect, useRef, useState } from 'react';
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
 * Because the slides carry no text, they are decorative. `alt=""` is correct
 * for that - inventing descriptions for artwork would add noise to a screen
 * reader and say nothing the shopper can act on - and the controls are hidden
 * from assistive tech for the same reason. Nothing here is reachable only via
 * the carousel; the nav above it goes everywhere this does.
 */

interface Slide {
  url: string;
}

const SLIDES: readonly Slide[] = [
  {
    url: 'https://res.cloudinary.com/daqfxkc3u/image/upload/v1770014043/Gemini_Generated_Image_opandhopandhopan_bvewuv.jpg'
  },
  {
    url: 'https://res.cloudinary.com/daqfxkc3u/image/upload/v1769780544/Classic_Court_Style._Modern_Comfort._1_xdk7tb.png'
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
        {SLIDES.map((slide, position) => (
          <li key={slide.url} className="w-full shrink-0 snap-start">
            {/*
              A fixed box the artwork is cropped into, because the two sources
              are different shapes - 16:9 and 3:2 - and letting each set its own
              height would make the page jump as they advance. Taller in
              proportion on a phone so the subject is not reduced to a strip.
            */}
            <div className="aspect-[4/3] w-full sm:aspect-[21/9]">
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
            </div>
          </li>
        ))}
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
