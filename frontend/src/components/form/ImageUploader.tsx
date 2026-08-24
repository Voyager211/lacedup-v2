import { useRef, useState } from 'react';
import { BsPlus, BsStarFill, BsTrash } from 'react-icons/bs';
import { validateImageFiles } from '@/lib/imageValidation';
import { cn } from '@/lib/cn';
import Button from '../Button';

/**
 * Multi-image upload.
 *
 * Replaces the five separate crop modals the EJS admin carried under two
 * naming conventions (`cropModal` x3, `cropperModal` x2), plus the 329-line
 * ImageCropperManager that - despite existing - was never actually loaded,
 * because each page inlined its own copy instead.
 *
 * Images are held as data URLs because that is what the product endpoints
 * accept: `base64Images[]` in the body, validated server-side with
 * `validateBase64Image`. Files are validated here first so a bad one is
 * rejected before an upload starts rather than after.
 *
 * Cropping is deliberately not included. The old flow cropped to a fixed
 * square before upload; the server resizes with sharp anyway, so the crop step
 * mostly existed to enforce an aspect ratio. If it turns out to be wanted,
 * `react-easy-crop` slots in behind this same interface.
 */
export interface ImageUploaderProps {
  /** Data URLs, in display order. */
  value: string[];
  onChange: (images: string[]) => void;
  /** Index of the image used as the main one. */
  mainIndex?: number;
  onMainIndexChange?: (index: number) => void;
  min?: number;
  max?: number;
  label?: string;
  error?: string;
}

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });

const ImageUploader = ({
  value,
  onChange,
  mainIndex = 0,
  onMainIndexChange,
  min = 3,
  max = 6,
  label = 'Images',
  error
}: ImageUploaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [reading, setReading] = useState(false);

  const room = max - value.length;

  const addFiles = async (files: FileList) => {
    const chosen = Array.from(files);
    const { accepted, errors } = validateImageFiles(chosen);

    // Take only what fits, and say so rather than silently dropping the rest.
    const withinLimit = accepted.slice(0, room);
    const overflow = accepted.length - withinLimit.length;

    const messages = [...errors];
    if (overflow > 0) {
      messages.push(`Only ${max} images allowed, so ${overflow} were not added.`);
    }

    setProblems(messages);

    if (withinLimit.length === 0) return;

    setReading(true);

    try {
      const dataUrls = await Promise.all(withinLimit.map(readAsDataUrl));
      onChange([...value, ...dataUrls]);
    } catch (caught) {
      setProblems((current) => [
        ...current,
        caught instanceof Error ? caught.message : 'Could not read one of those files.'
      ]);
    } finally {
      setReading(false);
    }
  };

  const removeAt = (index: number) => {
    onChange(value.filter((_, i) => i !== index));

    // Keep the main image pointing at the same picture, or fall back to the
    // first when the main one is the one being removed.
    if (!onMainIndexChange) return;
    if (index === mainIndex) onMainIndexChange(0);
    else if (index < mainIndex) onMainIndexChange(mainIndex - 1);
  };

  return (
    <div>
      <p className="block text-sm font-medium text-ink">
        {label}
        <span className="ml-2 font-normal text-ink-muted">
          {value.length} of {max} · at least {min}
        </span>
      </p>

      <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((image, index) => (
          <div
            key={index}
            className={cn(
              'group relative aspect-square overflow-hidden rounded-md border-2',
              index === mainIndex ? 'border-brand' : 'border-line'
            )}
          >
            <img src={image} alt="" className="size-full object-cover" />

            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {onMainIndexChange && (
                <button
                  type="button"
                  onClick={() => onMainIndexChange(index)}
                  aria-label={
                    index === mainIndex ? 'This is the main image' : 'Use as the main image'
                  }
                  className="rounded p-1 text-white hover:bg-white/20"
                >
                  <BsStarFill
                    className={cn('size-3.5', index === mainIndex && 'text-warning')}
                    aria-hidden="true"
                  />
                </button>
              )}

              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Remove this image"
                className="rounded p-1 text-white hover:bg-white/20"
              >
                <BsTrash className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            {index === mainIndex && (
              <span className="absolute left-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[0.625rem] font-semibold text-white">
                Main
              </span>
            )}
          </div>
        ))}

        {room > 0 && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={reading}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-ink-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
          >
            <BsPlus className="size-6" aria-hidden="true" />
            <span className="text-xs">Add</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          if (event.target.files?.length) void addFiles(event.target.files);
          // Reset so choosing the same file twice still fires a change.
          event.target.value = '';
        }}
      />

      {value.length < min && (
        <p className="mt-2 text-sm text-ink-muted">
          Add {min - value.length} more to meet the minimum of {min}.
        </p>
      )}

      {problems.length > 0 && (
        <ul className="mt-2 space-y-1" role="alert">
          {problems.map((problem) => (
            <li key={problem} className="text-sm text-danger">
              {problem}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}

      {value.length > 0 && (
        <Button
          className="mt-3"
          size="sm"
          variant="ghost"
          onClick={() => {
            onChange([]);
            onMainIndexChange?.(0);
            setProblems([]);
          }}
        >
          Remove all
        </Button>
      )}
    </div>
  );
};

export default ImageUploader;
