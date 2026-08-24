import { cn } from '@/lib/cn';
import {
  ORDER_STATUS,
  PAYMENT_STATUS,
  RETURN_STATUS,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
  type ReturnStatus
} from '@/types/domain';

/**
 * The one badge.
 *
 * Replaces five class families in design-system.css - payment-method-badge,
 * payment-status-badge, order-status-badge, each with a -table variant, plus
 * the legacy payment-badge / status-badge - which between them were 457 of
 * that file's 606 lines.
 *
 * The tone maps below are exhaustive over the domain unions, so adding a
 * status to types/domain.ts without giving it a colour is a type error rather
 * than a badge that silently renders grey.
 */

export type Tone = 'warning' | 'primary' | 'info' | 'success' | 'danger' | 'purple' | 'secondary';

const BOLD: Record<Tone, string> = {
  warning: 'bg-tone-warning text-tone-warning-fg',
  primary: 'bg-tone-primary text-tone-primary-fg',
  info: 'bg-tone-info text-tone-info-fg',
  success: 'bg-tone-success text-tone-success-fg',
  danger: 'bg-tone-danger text-tone-danger-fg',
  purple: 'bg-tone-purple text-tone-purple-fg',
  secondary: 'bg-tone-secondary text-tone-secondary-fg'
};

const SOFT: Record<Tone, string> = {
  warning: 'bg-tone-warning-soft text-tone-warning-soft-fg',
  primary: 'bg-tone-primary-soft text-tone-primary-soft-fg',
  info: 'bg-tone-info-soft text-tone-info-soft-fg',
  success: 'bg-tone-success-soft text-tone-success-soft-fg',
  danger: 'bg-tone-danger-soft text-tone-danger-soft-fg',
  purple: 'bg-tone-purple-soft text-tone-purple-soft-fg',
  secondary: 'bg-tone-secondary-soft text-tone-secondary-soft-fg'
};

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-1.5 text-xs',
  lg: 'px-5 py-2 text-xs'
} as const;

export interface BadgeProps {
  tone?: Tone;
  /** `soft` is the light pairing the old stylesheets used inside tables. */
  variant?: 'bold' | 'soft';
  size?: keyof typeof SIZES;
  /** Fixes the width so a column of badges lines up, as the -table variants did. */
  fixedWidth?: boolean;
  uppercase?: boolean;
  className?: string;
  children: React.ReactNode;
}

const Badge = ({
  tone = 'secondary',
  variant = 'soft',
  size = 'md',
  fixedWidth = false,
  uppercase = false,
  className,
  children
}: BadgeProps) => (
  <span
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-pill font-semibold tracking-wide',
      variant === 'bold' ? BOLD[tone] : SOFT[tone],
      SIZES[size],
      fixedWidth && 'w-[90px] overflow-hidden text-ellipsis',
      uppercase ? 'uppercase' : 'capitalize',
      className
    )}
  >
    {children}
  </span>
);

export default Badge;

/* Status → tone -------------------------------------------------------- */

/**
 * Read straight out of design-system.css, so these are the colours the app
 * shows today. Note `Partially Delivered` shares `Shipped`'s tone, and the
 * three return-ish order statuses share `Pending`'s.
 */
export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  [ORDER_STATUS.PENDING]: 'warning',
  [ORDER_STATUS.PROCESSING]: 'primary',
  [ORDER_STATUS.SHIPPED]: 'info',
  [ORDER_STATUS.PARTIALLY_DELIVERED]: 'info',
  [ORDER_STATUS.DELIVERED]: 'success',
  [ORDER_STATUS.CANCELLED]: 'danger',
  [ORDER_STATUS.FAILED]: 'danger',
  [ORDER_STATUS.RETURNED]: 'warning',
  [ORDER_STATUS.PARTIALLY_RETURNED]: 'warning',
  [ORDER_STATUS.PROCESSING_RETURN]: 'warning'
};

export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  [PAYMENT_STATUS.PENDING]: 'warning',
  [PAYMENT_STATUS.COMPLETED]: 'success',
  [PAYMENT_STATUS.PARTIALLY_COMPLETED]: 'info',
  [PAYMENT_STATUS.FAILED]: 'danger',
  [PAYMENT_STATUS.CANCELLED]: 'danger',
  [PAYMENT_STATUS.REFUNDED]: 'purple',
  [PAYMENT_STATUS.PARTIALLY_REFUNDED]: 'purple'
};

/**
 * Return statuses had no dedicated CSS - the admin returns page styled them ad
 * hoc - so these are chosen to sit consistently alongside the maps above.
 */
export const RETURN_STATUS_TONE: Record<ReturnStatus, Tone> = {
  [RETURN_STATUS.PENDING]: 'warning',
  [RETURN_STATUS.APPROVED]: 'primary',
  [RETURN_STATUS.REJECTED]: 'danger',
  [RETURN_STATUS.COMPLETED]: 'success'
};

/**
 * Payment methods were a separate palette in the CSS, but every colour was an
 * alias of an existing tone, so they map rather than duplicate.
 *
 * `online` is not in the PaymentMethod union but appears in stored orders, and
 * `card` and `netbanking` had no rule of their own - both fall through to the
 * razorpay tone they are processed under.
 */
const PAYMENT_METHOD_TONE: Record<string, Tone> = {
  cod: 'warning',
  razorpay: 'primary',
  online: 'primary',
  card: 'primary',
  netbanking: 'primary',
  wallet: 'success',
  upi: 'purple',
  paypal: 'primary'
};

export const paymentMethodTone = (method: PaymentMethod | string | null | undefined): Tone =>
  PAYMENT_METHOD_TONE[String(method ?? '').toLowerCase()] ?? 'secondary';
