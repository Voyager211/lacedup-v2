import { describe, expect, it } from 'vitest';
import { pageItems } from './paginate';

/**
 * Windowing is the thing none of the three original implementations did - the
 * one the admin layout actually loaded rendered every page number, so a
 * thousand-page result emitted a thousand buttons.
 */
describe('pageItems', () => {
  it('renders nothing for a single page', () => {
    expect(pageItems(1, 1)).toEqual([]);
    expect(pageItems(1, 0)).toEqual([]);
  });

  it('lists every page while they fit', () => {
    expect(pageItems(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('elides the tail when the current page is near the start', () => {
    expect(pageItems(2, 20)).toEqual([1, 2, 3, 'gap', 20]);
  });

  it('elides the head when the current page is near the end', () => {
    expect(pageItems(19, 20)).toEqual([1, 'gap', 18, 19, 20]);
  });

  it('elides both sides in the middle', () => {
    expect(pageItems(10, 20)).toEqual([1, 'gap', 9, 10, 11, 'gap', 20]);
  });

  it('always keeps the first and last page reachable', () => {
    const items = pageItems(50, 100);
    expect(items[0]).toBe(1);
    expect(items.at(-1)).toBe(100);
  });

  it('caps the button count regardless of how many pages there are', () => {
    // The whole point: 1,000 pages must not become 1,000 buttons.
    expect(pageItems(500, 1000)).toHaveLength(7);
  });

  it('shows a page rather than a gap when only one would be hidden', () => {
    // Eliding a single number costs the same space as showing it.
    expect(pageItems(3, 10)).toEqual([1, 2, 3, 4, 'gap', 10]);
  });

  it('widens the window when asked for more siblings', () => {
    expect(pageItems(10, 20, 2)).toEqual([1, 'gap', 8, 9, 10, 11, 12, 'gap', 20]);
  });

  it('never repeats a page number', () => {
    for (let page = 1; page <= 20; page += 1) {
      const numbers = pageItems(page, 20).filter((item) => item !== 'gap');
      expect(new Set(numbers).size).toBe(numbers.length);
    }
  });

  it('keeps the numbers in ascending order', () => {
    for (let page = 1; page <= 30; page += 1) {
      const numbers = pageItems(page, 30).filter((item): item is number => item !== 'gap');
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
    }
  });

  it('clamps a current page outside the range instead of breaking', () => {
    expect(() => pageItems(0, 10)).not.toThrow();
    expect(() => pageItems(99, 10)).not.toThrow();
    expect(pageItems(99, 10).at(-1)).toBe(10);
  });
});
