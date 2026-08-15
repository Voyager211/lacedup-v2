import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The admin page-header bar.
 *
 * Every admin page opens with the same block: the page's name on a dark navy
 * panel, what the page is for underneath it, and the page's actions on the
 * right. The EJS admin had a version of this on each page, written out again
 * every time - which is why the titles, the paddings and the button colours all
 * drifted apart.
 *
 * It carries the count of what is listed, because "Products" and "Products
 * (16)" answer different questions, and the second is the one an admin opening
 * a list page is actually asking.
 *
 * Actions go on the panel rather than beside the table, so a page's verbs are
 * always in the same place. They need their own styling: the ordinary Button
 * variants are drawn for a light ground and `outline` in particular disappears
 * against this one.
 */

export interface PageHeaderProps {
  title: ReactNode;
  /** Rendered as "(16)" after the title. Omitted while the count is unknown. */
  count?: number;
  /** One line on what the page is for. */
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

const PageHeader = ({ title, count, subtitle, actions, className }: PageHeaderProps) => (
  <header
    className={cn(
      'mb-6 rounded-2xl bg-linear-to-br from-panel to-panel-deep px-6 py-6 sm:px-8',
      className
    )}
  >
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-2xl font-bold text-white sm:text-3xl">
          {title}
          {/* A real space, not just a margin: the two run together in the
              accessible name otherwise - "Product Management(16)". */}
          {count != null && <span className="tabular-nums">{` (${count})`}</span>}
        </h1>

        {subtitle && (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-white/60">{subtitle}</p>
        )}
      </div>

      {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
    </div>
  </header>
);

export default PageHeader;

/*
 * Actions.
 *
 * `neutral` is white at 10% rather than a fixed grey so it sits on the panel
 * gradient at either end of the bar without banding against it.
 */
const ACTION_TONES = {
  brand: 'bg-brand text-white hover:bg-brand-hover',
  neutral: 'bg-white/10 text-white hover:bg-white/20',
  success: 'bg-success text-white hover:bg-success-hover'
} as const;

const ACTION_BASE = cn(
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
  'text-sm font-semibold transition-colors',
  // The global focus ring is brand red, which is invisible on the brand button.
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
  'disabled:pointer-events-none disabled:opacity-50'
);

export interface HeaderActionProps {
  children: ReactNode;
  tone?: keyof typeof ACTION_TONES;
  icon?: ReactNode;
  onClick?: () => void;
  /** Renders a router link instead of a button. */
  to?: string;
  disabled?: boolean;
}

export const HeaderAction = ({
  children,
  tone = 'brand',
  icon,
  onClick,
  to,
  disabled
}: HeaderActionProps) => {
  const className = cn(ACTION_BASE, ACTION_TONES[tone]);

  if (to) {
    return (
      <Link to={to} className={className}>
        {icon}
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {icon}
      {children}
    </button>
  );
};

/** A read-only chip on the bar - today's date, and nothing that is clickable. */
export const HeaderPill = ({ children }: { children: ReactNode }) => (
  <span className={cn(ACTION_BASE, 'bg-white/10 text-white')}>{children}</span>
);
