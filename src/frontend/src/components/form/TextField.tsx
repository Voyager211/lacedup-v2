import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import Field, { controlClasses } from './Field';
import { cn } from '@/lib/cn';

interface Common {
  label: string;
  error?: string;
  hint?: string;
  containerClassName?: string;
}

export type TextFieldProps = Common & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

/**
 * A labelled text input.
 *
 * Designed for react-hook-form's `register()`, which spreads name, ref and the
 * change handlers - so the usual call is:
 *
 *   <TextField label="Email" {...register('email')} error={errors.email?.message} />
 */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, required, containerClassName, className, ...rest }, ref) => (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      {({ id, describedBy, invalid }) => (
        <input
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(controlClasses(invalid), className)}
          {...rest}
        />
      )}
    </Field>
  )
);

TextField.displayName = 'TextField';

export type TextAreaFieldProps = Common & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  ({ label, error, hint, required, containerClassName, className, rows = 4, ...rest }, ref) => (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(controlClasses(invalid), 'resize-y', className)}
          {...rest}
        />
      )}
    </Field>
  )
);

TextAreaField.displayName = 'TextAreaField';

export interface SelectOption {
  value: string;
  label: string;
}

export type SelectFieldProps = Common &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & {
    options: readonly SelectOption[];
    /** Leading empty option. Omit on a select that must always hold a value. */
    placeholder?: string;
  };

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  (
    { label, error, hint, required, containerClassName, className, options, placeholder, ...rest },
    ref
  ) => (
    <Field
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={containerClassName}
    >
      {({ id, describedBy, invalid }) => (
        <select
          ref={ref}
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          required={required}
          className={cn(controlClasses(invalid), className)}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
);

SelectField.displayName = 'SelectField';
