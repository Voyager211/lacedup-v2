/**
 * Page-number windowing.
 *
 * None of the three pagination implementations in the EJS layer did this. The
 * one the admin layout actually loaded rendered every page number, so a
 * thousand-page result emitted a thousand buttons; the only implementation
 * with a window was an EJS partial that nothing included.
 *
 * Returns the page numbers to render, with `'gap'` markers where a run was
 * elided. First and last are always present so the ends stay reachable.
 */
export type PageItem = number | 'gap';

export const pageItems = (
  currentPage: number,
  totalPages: number,
  /** How many neighbours to show either side of the current page. */
  siblings = 1
): PageItem[] => {
  if (totalPages <= 1) return [];

  // first + last + current + 2 gaps + siblings either side
  const slots = siblings * 2 + 5;

  if (totalPages <= slots) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const page = Math.min(Math.max(currentPage, 1), totalPages);
  const left = Math.max(page - siblings, 1);
  const right = Math.min(page + siblings, totalPages);

  // A gap is only worth drawing if it hides more than one page - eliding a
  // single number costs the same space as showing it.
  const gapBefore = left > 2;
  const gapAfter = right < totalPages - 1;

  const items: PageItem[] = [1];

  if (gapBefore) items.push('gap');
  else if (left === 2) items.push(2);

  for (let index = Math.max(left, 2); index <= Math.min(right, totalPages - 1); index += 1) {
    if (!items.includes(index)) items.push(index);
  }

  if (gapAfter) items.push('gap');
  else if (right === totalPages - 1 && !items.includes(totalPages - 1)) items.push(totalPages - 1);

  items.push(totalPages);

  return items;
};
