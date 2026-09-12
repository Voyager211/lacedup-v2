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

/**
 * Slides can link, so a router has to be in scope even when none currently
 * does - otherwise adding one href turns every test in this file red.
 */
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

  it('renders every slide as decorative artwork', () => {
    const { container } = renderCarousel();

    const images = [...container.querySelectorAll('img')];

    expect(images).toHaveLength(2);
    for (const image of images) {
      expect(image).toHaveAttribute('alt', '');
    }
  });

  /** Full-bleed artwork shipped at source resolution would dominate first paint. */
  it('requests the artwork through the transform pipeline', () => {
    const { container } = renderCarousel();

    for (const image of container.querySelectorAll('img')) {
      expect(image.getAttribute('src')).toContain('f_auto,q_auto');
      expect(image.getAttribute('srcset')).toContain('w_640');
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
