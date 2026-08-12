import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { BsEye, BsEyeSlash } from 'react-icons/bs';
import Field, { controlClasses } from './Field';
import { cn } from '@/lib/cn';

/**
 * Password input with a visibility toggle, and optionally a strength meter.
 *
 * The toggle was hand-rolled on six pages; the meter was 450 lines of inline
 * script on change-password alone. Both are here once.
 */

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
}

/**
 * A deliberately simple estimate.
 *
 * Length carries three of the five points, because it is what actually
 * resists a brute force - a long passphrase beats a short string with a symbol
 * bolted on. Scoring character classes alone would rate `aB1!` as highly as a
 * twenty-character passphrase, which is backwards.
 *
 * UI guidance only; the server enforces the real rule.
 */
export const passwordStrength = (password: string): PasswordStrength => {
  if (!password) return { score: 0, label: 'Enter a password' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  const clamped = Math.min(score, 4) as PasswordStrength['score'];
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'] as const;

  return { score: clamped, label: labels[clamped] };
};

const METER_COLOURS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-info', 'bg-success'] as const;

export interface PasswordFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
  /** Shows the meter. Pass the current value so it can be scored. */
  showStrength?: boolean;
  value?: string;
}

const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    { label, error, hint, required, containerClassName, className, showStrength, value, ...rest },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const strength = showStrength ? passwordStrength(String(value ?? '')) : null;

    return (
      <Field
        label={label}
        error={error}
        hint={hint}
        required={required}
        className={containerClassName}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <div className="relative">
              <input
                ref={ref}
                id={id}
                type={visible ? 'text' : 'password'}
                value={value}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                required={required}
                className={cn(controlClasses(invalid), 'pr-11', className)}
                {...rest}
              />

              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                // The control is the input; the toggle is decoration around it.
                tabIndex={-1}
                aria-label={visible ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-ink-muted transition-colors hover:text-ink"
              >
                {visible ? (
                  <BsEyeSlash className="size-4" aria-hidden="true" />
                ) : (
                  <BsEye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {strength && (
              <div className="pt-1">
                <div className="flex gap-1" aria-hidden="true">
                  {[0, 1, 2, 3].map((segment) => (
                    <span
                      key={segment}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-colors',
                        segment < strength.score ? METER_COLOURS[strength.score] : 'bg-line'
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-muted" aria-live="polite">
                  {strength.label}
                </p>
              </div>
            )}
          </>
        )}
      </Field>
    );
  }
);

PasswordField.displayName = 'PasswordField';

export default PasswordField;
