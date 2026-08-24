import { BsChevronLeft, BsChevronRight } from 'react-icons/bs';
import { cn } from '@/lib/cn';
import { pageItems } from '@/lib/paginate';

/**
 * The one pagination control.
 *
 * Replaces three JavaScript implementations - two of them byte-identical, and
 * none of them loaded on the storefront - plus two EJS partials and the
 * per-page reimplementations every paginated view fell back on.
 *
 * Renders nothing for a single page, matching the old partial.
 */
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Neighbours either side of the current page before eliding. */
  siblings?: number;
  /** Greys out the control while a page is loading, without unmounting it. */
  disabled?: boolean;
  className?: string;
  label?: string;
}

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  siblings = 1,
  disabled = false,
  className,
  label = 'Pagination'
}: PaginationProps) => {
  const items = pageItems(currentPage, totalPages, siblings);

  if (items.length === 0) return null;

  const go = (page: number) => {
    if (disabled || page === currentPage || page < 1 || page > totalPages) return;
    onPageChange(page);
  };

  const arrow = 'inline-flex size-9 items-center justify-center rounded-md border border-line';

  return (
    <nav aria-label={label} className={cn('flex items-center justify-center gap-1', className)}>
      <button
        type="button"
        onClick={() => go(currentPage - 1)}
        disabled={disabled || currentPage <= 1}
        aria-label="Previous page"
        className={cn(arrow, 'transition-colors hover:bg-card disabled:opacity-40 disabled:hover:bg-transparent')}
      >
        <BsChevronLeft className="size-4" aria-hidden="true" />
      </button>

      {items.map((item, index) =>
        item === 'gap' ? (
          <span
            // Gaps have no stable identity of their own; there are at most two
            // and they never reorder, so the index is safe here.
            key={`gap-${index}`}
            aria-hidden="true"
            className="inline-flex size-9 items-center justify-center text-ink-muted"
          >
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => go(item)}
            disabled={disabled}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-md text-sm font-medium transition-colors',
              item === currentPage
                ? 'bg-ink text-white'
                : 'border border-line text-ink hover:bg-card',
              disabled && 'opacity-40'
            )}
          >
            {item}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => go(currentPage + 1)}
        disabled={disabled || currentPage >= totalPages}
        aria-label="Next page"
        className={cn(arrow, 'transition-colors hover:bg-card disabled:opacity-40 disabled:hover:bg-transparent')}
      >
        <BsChevronRight className="size-4" aria-hidden="true" />
      </button>
    </nav>
  );
};

export default Pagination;
