import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * The label / control / error scaffolding every field shares.
 *
 * The EJS layer rendered errors three different ways - a class that injected
 * `.field-error` divs, per-page hand-rolled validators, and static
 * `.error-message` elements shipped in the markup with hardcoded copy. None of
 * them wired the message to the input, so screen readers announced a red
 * message next to a field that still claimed to be valid.
 */
export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Receives the ids to attach, so the control stays accessible. */
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

const Field = ({ label, error, hint, required, className, children }: FieldProps) => {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {children({ id, describedBy, invalid: Boolean(error) })}

      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default Field;

/** Shared input chrome, so every control looks the same and reacts the same. */
export const controlClasses = (invalid: boolean) =>
  cn(
    'w-full rounded-md border bg-white px-3 py-2.5 text-ink transition-colors',
    'placeholder:text-ink-muted/60 disabled:cursor-not-allowed disabled:bg-card disabled:opacity-70',
    invalid ? 'border-danger focus-visible:outline-danger' : 'border-line'
  );
