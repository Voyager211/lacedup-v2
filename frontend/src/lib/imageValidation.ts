/**
 * Image validation, ported from public/utils/imageValidation.js.
 *
 * The limits match the server, which re-validates every upload - these checks
 * exist to fail fast in the browser, not to be trusted. Kept free of DOM and
 * React imports so the backend can import it too and the two sides cannot
 * drift, which is the whole reason the original was written as a dual export.
 */

export const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'] as const;

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml'
] as const;

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / 1024 ** exponent;

  return `${exponent === 0 ? size : size.toFixed(1)} ${units[exponent]}`;
};

export const isValidExtension = (filename: string): boolean => {
  const dot = filename.lastIndexOf('.');
  if (dot < 0) return false;

  return (ALLOWED_EXTENSIONS as readonly string[]).includes(filename.slice(dot).toLowerCase());
};

export const isValidMimeType = (type: string): boolean =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(type.toLowerCase());

export const isValidFileSize = (size: number): boolean => size > 0 && size <= MAX_FILE_SIZE;

/**
 * Extension and MIME type are both checked.
 *
 * Either alone is weak: a renamed .exe passes the extension check by claiming
 * to be a .png, and a browser will happily report a MIME type for a file whose
 * name says otherwise. Neither is proof - the server decides - but requiring
 * both catches honest mistakes before an upload starts.
 */
export const validateImageFile = (file: File): ValidationResult => {
  if (!isValidExtension(file.name)) {
    return {
      valid: false,
      error: `${file.name} is not an image. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`
    };
  }

  if (!isValidMimeType(file.type)) {
    return { valid: false, error: `${file.name} does not look like a real image file.` };
  }

  if (!isValidFileSize(file.size)) {
    return {
      valid: false,
      error: `${file.name} is ${formatFileSize(file.size)}. The limit is ${formatFileSize(MAX_FILE_SIZE)}.`
    };
  }

  return { valid: true };
};

export const validateImageFiles = (
  files: readonly File[]
): { valid: boolean; errors: string[]; accepted: File[] } => {
  const errors: string[] = [];
  const accepted: File[] = [];

  for (const file of files) {
    const result = validateImageFile(file);
    if (result.valid) accepted.push(file);
    else if (result.error) errors.push(result.error);
  }

  return { valid: errors.length === 0, errors, accepted };
};

const BASE64_IMAGE = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/;

/**
 * Validates a cropped image before it is submitted.
 *
 * The admin product forms send images as base64 in the form body rather than
 * as files, so this is the only check standing between a bad crop and a
 * rejected save. The size is estimated from the string length - base64 encodes
 * three bytes as four characters.
 */
export const validateBase64Image = (data: string, label = 'Image'): ValidationResult => {
  if (!BASE64_IMAGE.test(data)) {
    return { valid: false, error: `${label} is not a supported image format.` };
  }

  const payload = data.slice(data.indexOf(',') + 1);
  const bytes = Math.floor((payload.length * 3) / 4);

  if (!isValidFileSize(bytes)) {
    return {
      valid: false,
      error: `${label} is ${formatFileSize(bytes)}. The limit is ${formatFileSize(MAX_FILE_SIZE)}.`
    };
  }

  return { valid: true };
};
