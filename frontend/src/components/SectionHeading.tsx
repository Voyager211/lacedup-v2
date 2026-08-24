import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The heading that opens a landing-page section.
 *
 * Centred, bold, and large, with an optional red rule beneath it and an
 * optional line of supporting text - the shape the storefront's sections have
 * always had. It lives here rather than in each section because four sections
 * use it and they drifted apart the last time each wrote its own: three sizes,
 * two weights, and two different alignments between them.
 */

export interface SectionHeadingProps {
  children: ReactNode;
  subtitle?: ReactNode;
  /** The short red rule under the title. */
  underline?: boolean;
  /** Inverts the palette for a section on a dark ground. */
  onDark?: boolean;
  className?: string;
}

const SectionHeading = ({
  children,
  subtitle,
  underline = false,
  onDark = false,
  className
}: SectionHeadingProps) => (
  <div className={cn('text-center', className)}>
    <h2
      className={cn(
        'font-heading text-3xl font-bold tracking-tight sm:text-4xl',
        onDark ? 'text-white' : 'text-ink'
      )}
    >
      {children}
    </h2>

    {underline && <span aria-hidden="true" className="mx-auto mt-3 block h-1 w-16 rounded-full bg-brand" />}

    {subtitle && (
      <p className={cn('mt-4 text-base', onDark ? 'text-white/70' : 'text-ink-muted')}>
        {subtitle}
      </p>
    )}
  </div>
);

export default SectionHeading;
