import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The storefront page title bar.
 *
 * The admin side's equivalent is a dark panel; this is its counterpart for the
 * shop, where the page is a white sheet and a black block would fight the
 * product photography. It is white with a red rule beneath it - the same brand
 * red, used as an underline rather than a fill.
 *
 * It holds the page's controls, and it is deliberately a sibling of the content
 * below rather than a parent of it: the bar must not move when something
 * underneath it opens or closes.
 */

export interface PageTitleBarProps {
  title: ReactNode;
  /** Rendered as "(16)" after the title. Omitted while the count is unknown. */
  count?: number;
  /** Sits with the title on the left - a filter toggle, say. */
  leading?: ReactNode;
  /** Sits at the right end: search, sort, and anything else that scopes the page. */
  children?: ReactNode;
  className?: string;
}

const PageTitleBar = ({ title, count, leading, children, className }: PageTitleBarProps) => (
  <header
    className={cn(
      'rounded-lg border border-line border-b-2 border-b-brand bg-white px-5 py-4 shadow-sm',
      className
    )}
  >
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <h1 className="font-heading text-xl font-semibold text-ink">
        {title}
        {/* A real space, so the two do not run together in the accessible name. */}
        {count != null && <span className="tabular-nums">{` (${count})`}</span>}
      </h1>

      {leading}

      {children && (
        <div className="ml-auto flex flex-wrap items-center gap-3">{children}</div>
      )}
    </div>
  </header>
);

export default PageTitleBar;
