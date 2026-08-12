import { useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';

/**
 * The 6-box OTP input.
 *
 * Three near-identical copies existed - signup verify-otp, reset-otp, and the
 * email-change flow - each around 260 lines of inline script. All three
 * auto-advanced on input; none of them handled paste, which is how most people
 * actually enter a code they have just been emailed.
 */
export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when the last box is filled, so the form can submit itself. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  error?: string;
  label?: string;
  className?: string;
}

const OtpInput = ({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled = false,
  error,
  label = 'One-time code',
  className
}: OtpInputProps) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const digits = value.padEnd(length, ' ').slice(0, length).split('');

  const commit = (next: string) => {
    const cleaned = next.replace(/\D/g, '').slice(0, length);
    onChange(cleaned);
    if (cleaned.length === length) onComplete?.(cleaned);
  };

  const focus = (index: number) => {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  };

  const handleChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    // Take the last character typed: with a box already filled, typing over it
    // should replace rather than be ignored.
    const digit = event.target.value.replace(/\D/g, '').slice(-1);
    if (!digit) return;

    const next = value.padEnd(length, ' ').split('');
    next[index] = digit;
    commit(next.join('').replace(/\s/g, ''));

    focus(index + 1);
  };

  const handleKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();

      const next = value.padEnd(length, ' ').split('');

      // Backspace in an empty box clears the previous one and steps back,
      // which is what makes correcting a mistyped code feel normal.
      if (!next[index]?.trim() && index > 0) {
        next[index - 1] = ' ';
        focus(index - 1);
      } else {
        next[index] = ' ';
      }

      commit(next.join('').replace(/\s/g, ''));
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focus(index - 1);
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      focus(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;

    commit(pasted);
    focus(pasted.length);
  };

  return (
    <div className={cn('space-y-2', className)}>
      <fieldset>
        <legend className="mb-2 block text-sm font-medium text-ink">{label}</legend>

        <div className="flex gap-2">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => {
                refs.current[index] = element;
              }}
              type="text"
              inputMode="numeric"
              // Lets browsers and iOS offer the code straight from the SMS or
              // email notification.
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={digit.trim()}
              disabled={disabled}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-invalid={error ? true : undefined}
              onChange={handleChange(index)}
              onKeyDown={handleKeyDown(index)}
              onPaste={handlePaste}
              onFocus={(event) => event.target.select()}
              className={cn(
                'size-12 rounded-md border bg-white text-center font-mono text-lg font-semibold text-ink',
                'transition-colors disabled:bg-card disabled:opacity-70',
                error ? 'border-danger' : 'border-line'
              )}
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
};

export default OtpInput;
