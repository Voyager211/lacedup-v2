import path from 'path';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { promises as fs } from 'fs';
import { UPLOADS_DIR } from '../../config/paths';
import { deleteFile } from './file-cleanup.util';

/**
 * One way in and one way out for every image the app stores.
 *
 * Before this, six controllers each ran their own copy of the same four lines -
 * mkdir, sharp().toFile(), build a '/uploads/<kind>/...' string by hand, hope it
 * matches what the delete path later assumes. They had already drifted: product
 * images were written to a cwd-relative directory rather than through paths.ts,
 * and profile photos stored a bare filename where everything else stored a URL,
 * which the React app then rendered as a src that could not resolve.
 *
 * Two backends sit behind the same call. Disk is the default and is what the
 * test suite and local development use - no credentials, no network. Cloudinary
 * takes over as soon as CLOUDINARY_URL is set, which is how production runs,
 * because Render's filesystem does not survive a restart and anything written
 * there outlives only the instance.
 */

/**
 * The folders images are filed under, on disk and in Cloudinary alike.
 *
 * A union rather than a string so a typo is a compile error instead of a new
 * folder appearing in the media library six months later.
 */
export type ImageFolder = 'products' | 'brands' | 'categories' | 'reviews' | 'profiles';

export interface ImageTransform {
  width: number;
  height: number;
  /**
   * 'cover' crops to fill the box, which is what catalogue artwork wants so a
   * grid of products lines up. 'inside' fits within it and keeps the aspect
   * ratio, which is what review photos want - a customer's snapshot of a shoe
   * should not have its edges cut off to make a square.
   */
  fit?: 'cover' | 'inside';
  /** Pairs with 'inside': never scale a small image up to the box. */
  withoutEnlargement?: boolean;
  /** webp everywhere except profile photos, which were jpeg before this. */
  format?: 'webp' | 'jpeg';
  quality?: number;
}

export interface StoredImage {
  /** Goes in the database and straight into an <img src>. Absolute under Cloudinary, root-relative on disk. */
  url: string;
  /** The name the file was stored under, without a directory. */
  filename: string;
}

/**
 * The root folder in Cloudinary. Everything is filed under
 * `<root>/<folder>/<name>`, so one account can host more than one project and
 * the media library stays navigable.
 */
const ROOT_FOLDER = process.env.CLOUDINARY_FOLDER || 'lacedup';

/**
 * Cloudinary is used when it is configured and not otherwise.
 *
 * Reading the env var rather than NODE_ENV means a developer can point at a
 * real Cloudinary account to reproduce something without pretending to be
 * production, and that the test suite - which sets neither - always gets disk.
 */
const useCloudinary = (): boolean => Boolean(process.env.CLOUDINARY_URL);

let configured = false;

/**
 * The SDK reads CLOUDINARY_URL itself, but only at the moment it is configured.
 * Doing that lazily rather than at import time keeps the module importable by
 * the test suite, which loads every controller and has no credentials.
 */
const ensureConfigured = (): void => {
  if (configured) return;
  cloudinary.config({ secure: true });
  configured = true;
};

/** Strips directories and extension, and anything that would need escaping in a URL. */
const safeName = (originalName: string): string => {
  const base = path.basename(originalName, path.extname(originalName));
  const cleaned = base.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').slice(0, 60);
  return cleaned || 'image';
};

/** `<timestamp>-<name>`, which is what made the previous filenames collision-resistant. */
const uniqueName = (originalName: string): string => `${Date.now()}-${safeName(originalName)}`;

const applyTransform = (buffer: Buffer, transform: ImageTransform): Promise<Buffer> => {
  const fit = transform.fit ?? 'cover';

  const pipeline = sharp(buffer).resize(transform.width, transform.height, {
    fit,
    // Only meaningful when cropping; sharp ignores it for 'inside'.
    ...(fit === 'cover' ? { position: 'center' } : {}),
    ...(transform.withoutEnlargement ? { withoutEnlargement: true } : {})
  });

  return transform.format === 'jpeg'
    ? pipeline.jpeg({ quality: transform.quality ?? 90 }).toBuffer()
    : pipeline.webp({ quality: transform.quality ?? 90 }).toBuffer();
};

/**
 * Stores one image and returns where it went.
 *
 * The resize happens here for both backends rather than being handed to
 * Cloudinary's transformation pipeline, so that the bytes stored are the same
 * ones in either mode and switching backends cannot quietly change how a
 * product photo is cropped.
 */
export const storeImage = async (
  buffer: Buffer,
  folder: ImageFolder,
  transform: ImageTransform,
  originalName = 'image'
): Promise<StoredImage> => {
  const extension = transform.format === 'jpeg' ? 'jpg' : 'webp';
  const name = uniqueName(originalName);
  const processed = await applyTransform(buffer, transform);

  if (!useCloudinary()) {
    const directory = path.join(UPLOADS_DIR, folder);
    await fs.mkdir(directory, { recursive: true });
    const filename = `${name}.${extension}`;
    await fs.writeFile(path.join(directory, filename), processed);

    return { url: `/uploads/${folder}/${filename}`, filename };
  }

  ensureConfigured();

  /**
   * `public_id` is set rather than left to Cloudinary.
   *
   * It is what makes the public id recoverable from the stored URL later, which
   * is what lets deletion work without a second column on five models to carry
   * the id alongside every URL. Left to itself the SDK appends a random suffix,
   * and the mapping stops being reversible.
   *
   * `overwrite: false` because the name already carries a timestamp: if one
   * ever did collide, failing is better than replacing an image another
   * document still points at.
   */
  const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        public_id: `${ROOT_FOLDER}/${folder}/${name}`,
        resource_type: 'image',
        overwrite: false
      },
      (error, uploaded) => {
        if (error || !uploaded) return reject(error ?? new Error('Cloudinary upload returned nothing'));
        resolve({ secure_url: uploaded.secure_url, public_id: uploaded.public_id });
      }
    );

    stream.end(processed);
  });

  return { url: result.secure_url, filename: `${name}.${extension}` };
};

/** The array form, preserving order. */
export const storeImages = async (
  files: Array<{ buffer: Buffer; originalname?: string }>,
  folder: ImageFolder,
  transform: ImageTransform
): Promise<StoredImage[]> => {
  const stored: StoredImage[] = [];

  for (const file of files) {
    stored.push(await storeImage(file.buffer, folder, transform, file.originalname ?? 'image'));
  }

  return stored;
};

/**
 * The public id for a Cloudinary delivery URL.
 *
 * Upload URLs are `<host>/<cloud>/image/upload/[transformations/]v<n>/<public id>.<ext>`.
 * Everything after the version segment is the id, extension removed - and since
 * storeImage sets the id itself and stores the untransformed secure_url, that
 * round trip is exact. Returns null for anything that is not such a URL, which
 * is how a legacy '/uploads/...' value is told apart from a Cloudinary one.
 */
export const publicIdFromUrl = (url: string): string | null => {
  const match = /\/image\/upload\/(?:.*?\/)?v\d+\/(.+)$/.exec(url);
  if (!match?.[1]) return null;

  const withoutExtension = match[1].replace(/\.[a-zA-Z0-9]+$/, '');
  return withoutExtension || null;
};

/**
 * Removes a stored image, wherever it lives.
 *
 * Takes the value as the database holds it, so callers do not have to know
 * which backend wrote it - which matters because a single database will hold
 * both for as long as it takes to migrate the images that predate Cloudinary.
 *
 * Returns true when the image is gone, including when it was already gone:
 * cleanup runs after the document that referenced it is updated, and failing a
 * request because an orphan could not be deleted twice helps nobody.
 */
export const removeImage = async (stored: string): Promise<boolean> => {
  if (!stored) return true;

  const publicId = publicIdFromUrl(stored);

  if (!publicId) {
    // Not a Cloudinary URL, so it is a path under public/ - the disk backend's
    // own format, and the only thing that existed before this module.
    return deleteFile(stored);
  }

  try {
    ensureConfigured();
    const result = (await cloudinary.uploader.destroy(publicId)) as { result?: string };

    // 'not found' is reported rather than thrown, and means the same as success
    // here: nothing is left to delete.
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    console.error(`Failed to delete ${publicId} from Cloudinary:`, (error as Error).message);
    return false;
  }
};

/** The array form. Never rejects: one bad id should not abandon the rest. */
export const removeImages = async (stored: string[]): Promise<{ deleted: string[]; failed: string[] }> => {
  const deleted: string[] = [];
  const failed: string[] = [];

  for (const value of stored) {
    ((await removeImage(value)) ? deleted : failed).push(value);
  }

  return { deleted, failed };
};
