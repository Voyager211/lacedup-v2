/**
 * Comprehensive Image Validation Utility
 *
 * Server-side only. The original file also attached itself to `window` for the
 * browser, but this copy lives under src/backend and is never served - the
 * client-side copy is public/utils/imageValidation.js. That dead branch is
 * dropped here rather than carried into TypeScript.
 */

// Allowed image file extensions
export const ALLOWED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg'
] as const;

// Allowed MIME types for additional security
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/svg+xml'
] as const;

// Maximum file size (20 MB in bytes)
export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export interface ValidationResult {
  isValid: boolean;
  message: string;
}

/** Minimal shape shared by browser File objects and Multer uploads. */
export interface ValidatableFile {
  name: string;
  type: string;
  size: number;
}

/** Validate file extension. */
export function isValidExtension(filename: string): boolean {
  if (!filename) return false;

  const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
}

/** Validate MIME type. */
export function isValidMimeType(mimeType: string): boolean {
  if (!mimeType) return false;
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType.toLowerCase());
}

/** Validate file size. */
export function isValidFileSize(fileSize: number): boolean {
  return fileSize <= MAX_FILE_SIZE;
}

/** Format file size for display. */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/** Validate a single file. */
export function validateImageFile(file: ValidatableFile | null | undefined): ValidationResult {
  if (!file) {
    return { isValid: false, message: 'No file selected.' };
  }

  // Check file extension
  if (!isValidExtension(file.name)) {
    return {
      isValid: false,
      message:
        'Please select a valid image file. Only JPG, PNG, GIF, WEBP, BMP, and SVG files are allowed.'
    };
  }

  // Check MIME type for additional security
  if (!isValidMimeType(file.type)) {
    return {
      isValid: false,
      message: 'Invalid file type detected. Please select a valid image file.'
    };
  }

  // Check file size
  if (!isValidFileSize(file.size)) {
    return {
      isValid: false,
      message: `Image file size must not exceed 20 MB. Please choose a smaller image. Current size: ${formatFileSize(file.size)}`
    };
  }

  return { isValid: true, message: 'File is valid.' };
}

export interface MultipleValidationResult {
  isValid: boolean;
  validFiles: ValidatableFile[];
  invalidFiles: Array<{ file: ValidatableFile; error: string }>;
  errors: string[];
}

/** Validate multiple files. */
export function validateMultipleImageFiles(
  files: ArrayLike<ValidatableFile>
): MultipleValidationResult {
  const results: MultipleValidationResult = {
    isValid: true,
    validFiles: [],
    invalidFiles: [],
    errors: []
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const validation = validateImageFile(file);

    if (validation.isValid) {
      results.validFiles.push(file);
    } else {
      results.isValid = false;
      results.invalidFiles.push({
        file: file,
        error: validation.message
      });
      results.errors.push(`${file.name}: ${validation.message}`);
    }
  }

  return results;
}

/** Server-side validation for base64 images. */
export function validateBase64Image(base64String: string, filename = ''): ValidationResult {
  if (!base64String) {
    return { isValid: false, message: 'No image data provided.' };
  }

  // Check if it's a valid base64 image string
  const base64Regex = /^data:image\/(jpeg|jpg|png|gif|webp|bmp|svg\+xml);base64,/;
  if (!base64Regex.test(base64String)) {
    return {
      isValid: false,
      message: 'Invalid image format. Please select a valid image file.'
    };
  }

  // Extract and validate MIME type from base64 string
  const mimeTypeMatch = base64String.match(/^data:([^;]+);base64,/);
  if (!mimeTypeMatch || !isValidMimeType(mimeTypeMatch[1]!)) {
    return {
      isValid: false,
      message:
        'Please select a valid image file. Only JPG, PNG, GIF, WEBP, BMP, and SVG files are allowed.'
    };
  }

  // Estimate file size from base64 string (approximate)
  const base64Data = base64String.split(',')[1] ?? '';
  const estimatedSize = (base64Data.length * 3) / 4;

  if (!isValidFileSize(estimatedSize)) {
    return {
      isValid: false,
      message: `Image file size must not exceed 20 MB. Please choose a smaller image. Estimated size: ${formatFileSize(estimatedSize)}`
    };
  }

  // Validate filename if provided
  if (filename && !isValidExtension(filename)) {
    return {
      isValid: false,
      message:
        'Please select a valid image file. Only JPG, PNG, GIF, WEBP, BMP, and SVG files are allowed.'
    };
  }

  return { isValid: true, message: 'Image is valid.' };
}
