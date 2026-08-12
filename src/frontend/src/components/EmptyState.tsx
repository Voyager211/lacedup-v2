import type { ReactNode } from 'react';
import { BsInbox } from 'react-icons/bs';
import { cn } from '@/lib/cn';

/**
 * The one empty state.
 *
 * `.empty-state` was redefined independently in five views, alongside
 * `#no-results`, `#no-coupons-found`, `.search-no-results` and
 * `.no-brands-message`. The shape was always the same - a large muted icon, a
 * heading, a line of explanation - so only the CSS actually differed.
 */
export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: ReactNode;
  /** A way out: "Browse the shop", "Clear filters". */
  action?: ReactNode;
  className?: string;
}

const EmptyState = ({ title, message, icon, action, className }: EmptyStateProps) => (
  <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
    <div className="text-ink-muted/40" aria-hidden="true">
      {icon ?? <BsInbox className="size-14" />}
    </div>

    <h3 className="mt-5 font-heading text-lg font-semibold text-ink">{title}</h3>
    {message && <p className="mt-2 max-w-sm text-sm text-ink-muted">{message}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export default EmptyState;
