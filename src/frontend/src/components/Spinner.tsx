import { cn } from '@/lib/cn';

/**
 * The one spinner.
 *
 * The EJS layer had five separate loading idioms - Bootstrap's spinner-border
 * in 17 views, a blocking SweetAlert modal in three scripts, a rotating icon
 * swapped into pagination buttons, a bespoke shimmer for the wallet balance,
 * and per-page showLoadingState() functions in admin.
 */
const SIZES = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]'
} as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES;
  className?: string;
  /** Announced to screen readers. Pass null on a spinner inside a labelled control. */
  label?: string | null;
}

const Spinner = ({ size = 'md', className, label = 'Loading' }: SpinnerProps) => (
  <span
    className={cn(
      'inline-block animate-spin rounded-full border-current/25 border-t-current',
      SIZES[size],
      className
    )}
    role={label ? 'status' : undefined}
    aria-label={label ?? undefined}
    aria-hidden={label ? undefined : true}
  />
);

export default Spinner;
