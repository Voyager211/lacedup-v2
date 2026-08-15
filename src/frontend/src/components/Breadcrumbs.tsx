import { Link } from 'react-router-dom';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * The breadcrumb trail, shared by the storefront and the admin panel.
 *
 * The trail sits on a white card of its own, hugging its contents rather than
 * spanning the column, so it reads as a control on the page rather than a line
 * of text at the top of it. Both shells put it on the warm canvas, which is
 * what gives the card its edge.
 *
 * Each crumb inside is a pill rather than plain text: links tint red and take a
 * soft red ground on hover, so the clickable part of the trail is obvious
 * before you point at it. The current page is a pill too, but a static one - it
 * reads as part of the same trail without pretending to be a link.
 *
 * Icons are optional per crumb and purely decorative; the label carries the
 * meaning, so they are hidden from assistive tech.
 */

export interface Crumb {
  label: string;
  /** Omitted on the last crumb, which is the current page. */
  to?: string;
  icon?: LucideIcon;
}

export interface BreadcrumbsProps {
  items: Crumb[];
  className?: string;
}

const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => (
  <nav aria-label="Breadcrumb" className={cn('min-w-0', className)}>
    <ol
      className={cn(
        'flex w-fit max-w-full flex-wrap items-center gap-1 text-sm',
        'rounded-xl border border-line/60 bg-white px-2 py-1.5 shadow-sm'
      )}
    >
      {items.map((crumb, index) => {
        const Icon = crumb.icon;
        const last = index === items.length - 1;

        return (
          <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && (
              <ChevronRight
                className="size-4 shrink-0 text-ink-muted/60"
                aria-hidden="true"
                strokeWidth={2}
              />
            )}

            {crumb.to && !last ? (
              <Link
                to={crumb.to}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-ink-muted',
                  'transition-colors hover:bg-brand/10 hover:text-brand'
                )}
              >
                {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                {crumb.label}
              </Link>
            ) : (
              <span
                aria-current="page"
                className="flex min-w-0 items-center gap-1.5 rounded-md px-2 py-1 font-semibold text-ink"
              >
                {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                <span className="truncate">{crumb.label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumbs;
