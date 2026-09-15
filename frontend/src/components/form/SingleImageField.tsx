import { useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { validateImageFiles } from '@/lib/imageValidation';
import { cloudinaryUrl } from '@/lib/cloudinary';
import { cn } from '@/lib/cn';
import Button from '../Button';
import Field from './Field';

/**
 * One image, chosen and previewed in place - a category's or a brand's artwork.
 *
 * `<ImageUploader>` is the product form's three-to-six gallery with a main
 * image; this is its single-image sibling and shares its rules: the same
 * client-side validation, and the image held as a data URL because that is
 * what the endpoints take.
 *
 * The value is whatever is current - the stored URL, a data URL for a file
 * just picked, or empty. A pick can be undone back to the stored image.
 * Clearing a stored image outright is not offered, because neither endpoint
 * has a way to remove one.
 */
export interface SingleImageFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  required?: boolean;
  containerClassName?: string;
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

const SingleImageField = ({
  label,
  value,
  onChange,
  hint,
  required,
  containerClassName
}: SingleImageFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string>();
  const [reading, setReading] = useState(false);

  const picked = value.startsWith('data:');

  // The image before a pick, so undoing one has somewhere to go back to.
  const stored = useRef(value);
  if (!picked) stored.current = value;

  const choose = async (file: File) => {
    const { accepted, errors } = validateImageFiles([file]);
    setProblem(errors[0]);

    const image = accepted[0];
    if (!image) return;

    setReading(true);

    try {
      onChange(await readAsDataUrl(image));
    } catch (caught) {
      setProblem(caught instanceof Error ? caught.message : 'Could not read that file.');
    } finally {
      setReading(false);
    }
  };

  return (
    <Field
      label={label}
      hint={hint}
      error={problem}
      required={required}
      className={containerClassName}
    >
      {({ id, describedBy, invalid }) => (
        <div className="flex flex-wrap items-center gap-4">
          <div
            className={cn(
              'size-24 shrink-0 overflow-hidden rounded-md border bg-card',
              invalid ? 'border-danger' : 'border-line'
            )}
          >
            {value ? (
              // Data URLs pass through cloudinaryUrl untouched.
              <img src={cloudinaryUrl(value, { width: 192 })} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-ink-muted">
                <ImageOff className="size-8" aria-hidden="true" strokeWidth={1.5} />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              loading={reading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? 'Replace image' : 'Choose image'}
            </Button>

            {picked && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onChange(stored.current);
                  setProblem(undefined);
                }}
              >
                {stored.current ? 'Keep current image' : 'Remove'}
              </Button>
            )}
          </div>

          <input
            id={id}
            ref={inputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void choose(file);
              // Reset so choosing the same file twice still fires a change.
              event.target.value = '';
            }}
          />
        </div>
      )}
    </Field>
  );
};

export default SingleImageField;
