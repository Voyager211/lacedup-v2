import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Compose class names, letting later Tailwind classes win.
 *
 * Plain concatenation does not work with Tailwind: `"px-4" + "px-2"` leaves
 * both in the string and the winner is whichever CSS rule came last in the
 * stylesheet, not the one the caller passed last. twMerge resolves conflicts
 * by utility group, so a `className` prop can reliably override a component's
 * defaults.
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
