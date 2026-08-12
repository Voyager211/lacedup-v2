import { describe, expect, it } from 'vitest';
import {
  MAX_FILE_SIZE,
  formatFileSize,
  isValidExtension,
  validateBase64Image,
  validateImageFile,
  validateImageFiles
} from './imageValidation';

/**
 * The size has to be stamped on the File itself. Overriding it on a source
 * Blob does not work - the File constructor recomputes size from the parts it
 * is given, so the override is discarded.
 */
const file = (name: string, type: string, size: number): File => {
  const created = new File(['x'], name, { type });
  Object.defineProperty(created, 'size', { value: size });
  return created;
};

describe('isValidExtension', () => {
  it.each(['photo.jpg', 'photo.JPEG', 'a.png', 'b.webp', 'c.svg'])('accepts %s', (name) => {
    expect(isValidExtension(name)).toBe(true);
  });

  it.each(['script.js', 'doc.pdf', 'noextension', 'archive.zip'])('rejects %s', (name) => {
    expect(isValidExtension(name)).toBe(false);
  });

  it('reads the last dot, not the first', () => {
    expect(isValidExtension('holiday.photo.png')).toBe(true);
    expect(isValidExtension('image.png.exe')).toBe(false);
  });
});

describe('validateImageFile', () => {
  it('accepts a normal image', () => {
    expect(validateImageFile(file('shoe.png', 'image/png', 1024))).toEqual({ valid: true });
  });

  it('rejects a file whose name lies about its type', () => {
    // Extension says image, MIME says otherwise - checking only one is what
    // lets a renamed file through.
    const result = validateImageFile(file('payload.png', 'application/x-msdownload', 1024));
    expect(result.valid).toBe(false);
  });

  it('rejects an image over the size limit', () => {
    const result = validateImageFile(file('huge.jpg', 'image/jpeg', MAX_FILE_SIZE + 1));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/limit is 20/);
  });

  it('accepts a file exactly on the limit', () => {
    expect(validateImageFile(file('edge.jpg', 'image/jpeg', MAX_FILE_SIZE)).valid).toBe(true);
  });

  it('rejects an empty file', () => {
    expect(validateImageFile(file('empty.jpg', 'image/jpeg', 0)).valid).toBe(false);
  });
});

describe('validateImageFiles', () => {
  it('separates the good from the bad rather than failing the whole batch', () => {
    const result = validateImageFiles([
      file('a.png', 'image/png', 1024),
      file('b.pdf', 'application/pdf', 1024),
      file('c.jpg', 'image/jpeg', 2048)
    ]);

    expect(result.valid).toBe(false);
    expect(result.accepted).toHaveLength(2);
    expect(result.errors).toHaveLength(1);
  });

  it('reports valid for an all-good batch', () => {
    const result = validateImageFiles([file('a.png', 'image/png', 1024)]);
    expect(result).toMatchObject({ valid: true, errors: [] });
  });
});

describe('validateBase64Image', () => {
  it('accepts a supported data URL', () => {
    expect(validateBase64Image('data:image/png;base64,iVBORw0KGgo=').valid).toBe(true);
  });

  it('accepts svg+xml', () => {
    expect(validateBase64Image('data:image/svg+xml;base64,PHN2Zz4=').valid).toBe(true);
  });

  it.each([
    'data:text/html;base64,PGgxPmhpPC9oMT4=',
    'data:application/pdf;base64,JVBERi0=',
    'iVBORw0KGgo=',
    ''
  ])('rejects %s', (data) => {
    expect(validateBase64Image(data).valid).toBe(false);
  });

  it('rejects an oversized payload', () => {
    // base64 encodes 3 bytes as 4 characters, so this decodes to just over 20MB.
    const oversized = 'A'.repeat(Math.ceil(((MAX_FILE_SIZE + 1024) * 4) / 3));
    expect(validateBase64Image(`data:image/png;base64,${oversized}`).valid).toBe(false);
  });

  it('names the image in the error so a bulk upload says which one failed', () => {
    const result = validateBase64Image('data:text/html;base64,x', 'Image 3');
    expect(result.error).toMatch(/^Image 3/);
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [1536, '1.5 KB'],
    [20 * 1024 * 1024, '20.0 MB']
  ])('%s bytes -> %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});
