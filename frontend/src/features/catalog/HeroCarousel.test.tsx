import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HeroCarousel from './HeroCarousel';

/**
 * The landing hero.
 *
 * jsdom has no layout, so `clientWidth` is 0 and `scrollTo` does nothing on
 * its own - which means the scroll position cannot be asserted here. What is
 * worth pinning instead is everything that is a decision rather than a
 * measurement: that it carries no copy, that the artwork is decorative and
 * requested through the transform pipeline, and that it does not animate on
 * its own for someone who asked it not to.
 */

/** A slide links to a product, so the carousel needs somewhere to link into. */
const renderCarousel = () =>
  render(
    <MemoryRouter>
      <HeroCarousel />
    </MemoryRouter>
  );

const matchMedia = (reduced: boolean) =>
  vi.fn().mockImplementation((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

beforeEach(() => {
  window.matchMedia = matchMedia(false);
  Element.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('HeroCarousel', () => {
  it('is a named region so the page has a landmark where the hero was', () => {
    renderCarousel();

    expect(screen.getByRole('region', { name: /featured/i })).toBeInTheDocument();
  });

  /**
   * The brief was artwork only. Nothing in here should be readable copy - no
   * headline, no tagline, no call to action. A link is allowed, as long as it
   * is named for assistive tech rather than by rendering words.
   */
  it('carries no visible text', () => {
    const { container } = renderCarousel();

    expect(container.textContent?.trim()).toBe('');
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  /**
   * A link wrapping an `alt=""` image has nothing to announce, so screen
   * readers fall back to reading the URL. The name has to come from somewhere,
   * and aria-label is the one place it does not become visible copy.
   */
  it('links the featured slide to its product, named for screen readers', async () => {
    renderCarousel();

    const link = screen.getByRole('link', { name: 'Nike Court Vision Low Next Nature' });

    expect(link).toHaveAttribute('href', '/product/nike-court-vision-low-next-nature');
    expect(link.textContent).toBe('');
  });

  it('leaves the slide with no destination unlinked', () => {
    renderCarousel();

    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('renders every slide as decorative artwork', () => {
    const { container } = renderCarousel();

    const images = [...container.querySelectorAll('img')];

    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toHaveAttribute('alt', '');
    }
  });

  /** A 2.3MB PNG shipped raw would be the whole of the first paint. */
  it('requests the artwork through the transform pipeline', () => {
    const { container } = renderCarousel();

    for (const image of container.querySelectorAll('img')) {
      expect(image.getAttribute('src')).toContain('f_auto,q_auto');
      expect(image.getAttribute('srcset')).toContain('w_640');
    }
  });

  /**
   * The regression this replaced: the sources are 1.79 and 1.49, and cropping
   * both to fill one box cut the bottom off the taller one - which is the shoe
   * in the second slide. Padding to the box ratio instead means `object-cover`
   * has nothing left to crop. `c_pad` on every candidate is what holds it.
   */
  it('pads the artwork to the box ratio rather than cropping to it', () => {
    const { container } = renderCarousel();

    for (const image of container.querySelectorAll('img')) {
      expect(image.getAttribute('src')).toContain('c_pad,ar_16:9');
      expect(image.getAttribute('src')).not.toContain('c_limit');

      for (const candidate of image.getAttribute('srcset')!.split(', ')) {
        expect(candidate).toContain('c_pad,ar_16:9');
      }
    }
  });

  /** Only the slide that is actually visible on arrival is worth blocking on. */
  it('loads the first slide eagerly and defers the rest', () => {
    const { container } = renderCarousel();

    const [first, second] = [...container.querySelectorAll('img')];

    expect(first).toHaveAttribute('loading', 'eager');
    expect(second).toHaveAttribute('loading', 'lazy');
  });

  it('advances on its own', async () => {
    vi.useFakeTimers();
    renderCarousel();

    vi.advanceTimersByTime(6000);

    expect(Element.prototype.scrollTo).toHaveBeenCalled();
  });

  /**
   * Under prefers-reduced-motion nothing moves unless it is asked to. The
   * arrows and the swipe still work; only the timer goes away.
   */
  it('does not advance on its own when reduced motion is asked for', () => {
    window.matchMedia = matchMedia(true);
    vi.useFakeTimers();

    renderCarousel();
    vi.advanceTimersByTime(30000);

    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  });

  /** It should not move out from under someone who is looking at it. */
  it('pauses while the pointer is over it, and resumes after', () => {
    vi.useFakeTimers();
    renderCarousel();

    const region = screen.getByRole('region', { name: /featured/i });

    fireEvent.mouseEnter(region);
    vi.advanceTimersByTime(30000);
    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();

    fireEvent.mouseLeave(region);
    vi.advanceTimersByTime(6000);
    expect(Element.prototype.scrollTo).toHaveBeenCalled();
  });

  /** Same reasoning for keyboard users, who never generate a hover. */
  it('pauses while focus is inside it', () => {
    vi.useFakeTimers();
    renderCarousel();

    fireEvent.focus(screen.getByRole('region', { name: /featured/i }));
    vi.advanceTimersByTime(30000);

    expect(Element.prototype.scrollTo).not.toHaveBeenCalled();
  });
});
