import { useEffect, useState } from 'react';
import { BsSearch, BsX } from 'react-icons/bs';
import Button from './Button';

/**
 * Search and filter controls for an admin list.
 *
 * Ports the contract of `admin/partials/filters-bar.ejs` - the best-designed
 * thing in the EJS codebase, a fully parameterised search + filter component
 * that exactly one of the seven list pages used. The parameterisation survives;
 * the `window[callbackName]` indirection does not, because props do the same
 * job without the global.
 *
 * Deferred from step 1 deliberately: it had no consumer until now, and
 * building it against a guess would have meant guessing wrong.
 */
export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  name: string;
  label: string;
  options: FilterOption[];
  /** Leading entry, e.g. "All statuses". Omit for a filter that must have a value. */
  allLabel?: string;
}

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDefinition[];
  values?: Record<string, string>;
  onFilterChange?: (name: string, value: string) => void;
  onReset?: () => void;
  /** Rendered on the right - typically the "Add new" button. */
  actions?: React.ReactNode;
  /** Debounce before the search is reported, in ms. */
  debounceMs?: number;
}

const FilterBar = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  values = {},
  onFilterChange,
  onReset,
  actions,
  debounceMs = 350
}: FilterBarProps) => {
  const [draft, setDraft] = useState(search);

  // Keep the box in step when the value is reset from outside - clearing all
  // filters must clear what is typed, not just what was searched.
  useEffect(() => setDraft(search), [search]);

  useEffect(() => {
    if (draft === search) return undefined;

    const timer = setTimeout(() => onSearchChange(draft), debounceMs);
    return () => clearTimeout(timer);
  }, [draft, search, onSearchChange, debounceMs]);

  const hasFilters = search !== '' || Object.values(values).some(Boolean);

  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="relative min-w-0 flex-1 basis-64">
        <label htmlFor="filter-search" className="sr-only">
          {searchPlaceholder}
        </label>
        <BsSearch
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
          aria-hidden="true"
        />
        <input
          id="filter-search"
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-md border border-line bg-white py-2 pl-10 pr-9 text-sm"
        />
        {draft && (
          <button
            type="button"
            onClick={() => setDraft('')}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-muted hover:bg-card"
          >
            <BsX className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {filters.map((filter) => (
        <div key={filter.name}>
          <label
            htmlFor={`filter-${filter.name}`}
            className="mb-1 block text-xs font-medium text-ink-muted"
          >
            {filter.label}
          </label>
          <select
            id={`filter-${filter.name}`}
            value={values[filter.name] ?? ''}
            onChange={(event) => onFilterChange?.(filter.name, event.target.value)}
            className="rounded-md border border-line bg-white px-3 py-2 text-sm"
          >
            {filter.allLabel !== undefined && <option value="">{filter.allLabel}</option>}
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      {hasFilters && onReset && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          Clear
        </Button>
      )}

      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
};

export default FilterBar;
