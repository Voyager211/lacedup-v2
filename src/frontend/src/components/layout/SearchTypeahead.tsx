import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsSearch, BsX } from 'react-icons/bs';
import { useGetSearchSuggestionsQuery } from '@/features/catalog/catalog.api';
import { formatINR } from '@/lib/format';
import { cn } from '@/lib/cn';
import Spinner from '../Spinner';

/**
 * Navbar search with suggestions.
 *
 * Keeps the behaviour of the 537-line navbar partial - 300ms debounce, arrow
 * keys to highlight, Enter to select, Escape to close, click-outside to
 * dismiss - and adds two things it lacked:
 *
 *  - Images and prices in the dropdown. The endpoint always returned whole
 *    products; the old markup rendered `productName` and discarded the rest.
 *  - Out-of-order protection. RTK Query aborts a superseded request, so a slow
 *    response for "ni" can no longer land after "nike" and replace it.
 */
const DEBOUNCE_MS = 300;

const SearchTypeahead = ({ className }: { className?: string }) => {
  /*
   * The navbar renders this twice - once for desktop, once in the bar below it
   * on small screens - so hardcoded ids appeared twice in the DOM. The label
   * bound to whichever input came first, leaving the other unlabelled, and
   * aria-controls and aria-activedescendant pointed at the wrong copy's list.
   */
  const uid = useId();
  const inputId = `search-${uid}`;
  const listId = `suggestions-${uid}`;
  const optionId = (index: number) => `${listId}-${index}`;
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: suggestions = [], isFetching } = useGetSearchSuggestionsQuery(debounced, {
    skip: debounced.length < 2
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // A new result set invalidates whichever row was highlighted.
  useEffect(() => setHighlighted(-1), [suggestions]);

  const submit = (term: string) => {
    setOpen(false);
    navigate(`/shop?q=${encodeURIComponent(term)}`);
  };

  const choose = (slug: string) => {
    setOpen(false);
    setQuery('');
    navigate(`/product/${slug}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (suggestions.length === 0) return;

      setOpen(true);
      setHighlighted((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        // Wraps at both ends, so holding an arrow key cannot strand the user.
        return (next + suggestions.length) % suggestions.length;
      });
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const picked = suggestions[highlighted];
      if (picked) choose(picked.slug);
      else if (query.trim()) submit(query.trim());
    }
  };

  const showDropdown = open && debounced.length >= 2;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim()) submit(query.trim());
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Search products
        </label>

        <BsSearch
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />

        <input
          id={inputId}
          type="search"
          value={query}
          placeholder="Search for sneakers…"
          autoComplete="off"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            highlighted >= 0 ? optionId(highlighted) : undefined
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'w-full rounded-full border border-line bg-white py-2.5 pl-11 pr-9 text-sm text-ink',
            'placeholder:text-ink-muted/70 focus-visible:border-brand',
            /*
             * WebKit draws its own clear button inside type="search", which sat
             * next to the one below - two crosses, only one of which cleared the
             * suggestions. The type is kept for the search-key mobile keyboard
             * and the searchbox role; only its decoration is suppressed.
             */
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-search-decoration]:appearance-none'
          )}
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setOpen(false);
            }}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-card hover:text-ink"
          >
            <BsX className="size-4" aria-hidden="true" />
          </button>
        )}
      </form>

      {showDropdown && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute inset-x-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-line bg-white shadow-lg"
        >
          {isFetching && suggestions.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-ink-muted">
              <Spinner size="sm" label={null} />
              Searching…
            </div>
          )}

          {!isFetching && suggestions.length === 0 && (
            <p className="px-4 py-3 text-sm text-ink-muted">
              Nothing matched “{debounced}”.
            </p>
          )}

          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion._id}
              id={optionId(index)}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => choose(suggestion.slug)}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors',
                index === highlighted ? 'bg-card' : 'bg-white'
              )}
            >
              {suggestion.mainImage && (
                <img
                  src={suggestion.mainImage}
                  alt=""
                  loading="lazy"
                  className="size-10 shrink-0 rounded object-cover"
                />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {suggestion.productName}
                </span>
                {suggestion.brand?.name && (
                  <span className="block truncate text-xs text-ink-muted">
                    {suggestion.brand.name}
                  </span>
                )}
              </span>

              {typeof suggestion.averageFinalPrice === 'number' && (
                <span className="shrink-0 text-sm font-semibold text-brand">
                  {formatINR(Math.round(suggestion.averageFinalPrice))}
                </span>
              )}
            </button>
          ))}

          {suggestions.length > 0 && (
            <button
              type="button"
              onClick={() => submit(debounced)}
              className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-brand hover:bg-card"
            >
              See all results for “{debounced}”
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchTypeahead;
