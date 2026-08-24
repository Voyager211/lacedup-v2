import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import Spinner from './Spinner';

/**
 * The one button.
 *
 * `loading` disables the button as well as showing a spinner - the EJS pages
 * repeatedly showed a spinner while leaving the button clickable, which is how
 * duplicate orders and double coupon applications happen. The label keeps its
 * width while loading so the button does not jump.
 */
/**
 * Every variant resolves to brand red with white text on hover.
 *
 * That is the app's signature: whatever a button looks like at rest, pointing
 * at it turns it red. `danger` is the exception that proves it - it is already
 * red, and darkening rather than switching keeps a destructive action visually
 * distinct from a brand one at the moment of the click.
 */
const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-hover focus-visible:outline-brand',
  secondary: 'bg-ink text-white hover:bg-brand focus-visible:outline-ink',
  outline: 'border border-line bg-transparent text-ink hover:border-brand hover:bg-brand hover:text-white',
  ghost: 'bg-transparent text-ink hover:bg-brand hover:text-white',
  danger: 'bg-danger text-white hover:bg-danger-hover focus-visible:outline-danger'
} as const;

const SIZES = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-11 px-5 text-sm gap-2',
  lg: 'h-12 px-6 text-base gap-2'
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  loading?: boolean;
  /** Rendered before the label. Hidden while loading, so the spinner takes its place. */
  icon?: ReactNode;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...rest}
    >
      {loading ? <Spinner size="sm" label={null} /> : icon}
      {children}
    </button>
  )
);

Button.displayName = 'Button';

export default Button;
