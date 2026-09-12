import path from 'path';
import { promises as fs } from 'fs';
import sharp from 'sharp';
import { UPLOADS_DIR } from '../../../config/paths';
import { publicIdFromUrl, removeImage, storeImage, storeImages } from '../image-storage.util';

/**
 * The storage layer, on its disk backend.
 *
 * Cloudinary is not exercised here - it needs credentials and a network, and a
 * test that mocks the SDK end to end would mostly assert that the mock was
 * called. What is worth pinning is the contract both backends share, and the
 * URL round trip the Cloudinary path depends on.
 *
 * vitest.config.mjs blanks CLOUDINARY_URL for the whole suite, so these run
 * against the disk backend even on a machine whose .env holds real
 * credentials. Without that, this file would upload to a live account.
 */

const CLOUDINARY_HOST = 'https://res.cloudinary.com/demo/image/upload';

/** A real 4x4 png, so sharp has something valid to work on. */
const sourceImage = (): Promise<Buffer> =>
  sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 30, b: 47 } }
  })
    .png()
    .toBuffer();

const written: string[] = [];

afterAll(async () => {
  await Promise.all(written.map((file) => fs.rm(file, { force: true })));
});

/**
 * Reads an image back as bytes rather than handing sharp the path.
 *
 * sharp keeps the file open behind a path, which on Windows makes the unlink in
 * afterAll fail with EBUSY - the assertions pass and the suite still goes red.
 */
const metadataOf = async (url: string) => sharp(await fs.readFile(diskPathFor(url))).metadata();

/** Records what a test wrote so it can be cleaned up, and returns the path. */
const diskPathFor = (url: string): string => {
  const absolute = path.join(UPLOADS_DIR, url.replace('/uploads/', ''));
  written.push(absolute);
  return absolute;
};

describe('publicIdFromUrl', () => {
  it('recovers the id from a delivery URL, folders included', () => {
    expect(publicIdFromUrl(`${CLOUDINARY_HOST}/v1712000000/lacedup/products/1712-shoe.webp`)).toBe(
      'lacedup/products/1712-shoe'
    );
  });

  it('recovers the id when a transformation sits in the path', () => {
    expect(
      publicIdFromUrl(`${CLOUDINARY_HOST}/w_400,h_400/v1712000000/lacedup/brands/1712-brand.webp`)
    ).toBe('lacedup/brands/1712-brand');
  });

  /**
   * The invariant the whole design rests on: because storeImage sets the public
   * id itself and stores the untransformed secure_url, the id is always
   * recoverable from the stored value. That is what removes the need for a
   * second column on five models to carry the id alongside every URL.
   */
  it('round-trips every folder', () => {
    for (const folder of ['products', 'brands', 'categories', 'reviews', 'profiles']) {
      const id = `lacedup/${folder}/1712000000-example`;
      expect(publicIdFromUrl(`${CLOUDINARY_HOST}/v1712000000/${id}.webp`)).toBe(id);
    }
  });

  it('returns null for a disk path, which is how the two are told apart', () => {
    expect(publicIdFromUrl('/uploads/products/1712-shoe.webp')).toBeNull();
    expect(publicIdFromUrl('profile_abc_123.jpg')).toBeNull();
  });
});

describe('storeImage on disk', () => {
  it('writes into the folder it is given and returns a URL that matches', async () => {
    const stored = await storeImage(await sourceImage(), 'products', {
      width: 8,
      height: 8,
      format: 'webp'
    });

    expect(stored.url).toMatch(/^\/uploads\/products\/\d+-image\.webp$/);
    await expect(fs.access(diskPathFor(stored.url))).resolves.toBeUndefined();
  });

  it('applies the transform rather than storing the original', async () => {
    const stored = await storeImage(await sourceImage(), 'brands', {
      width: 8,
      height: 8,
      format: 'webp'
    });

    const meta = await metadataOf(stored.url);
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(8);
    expect(meta.height).toBe(8);
  });

  it('honours jpeg, which is what profile photos have always been', async () => {
    const stored = await storeImage(await sourceImage(), 'profiles', {
      width: 8,
      height: 8,
      format: 'jpeg'
    });

    expect(stored.url).toMatch(/\.jpg$/);
    expect((await metadataOf(stored.url)).format).toBe('jpeg');
  });

  /**
   * Review photos fit inside their box instead of being cropped to it. A 4x4
   * source asked for 8x6 comes back 4x4 rather than stretched, which is the
   * withoutEnlargement half, and never 8x6, which is the 'inside' half.
   */
  it('fits inside the box without enlarging, for reviews', async () => {
    const stored = await storeImage(await sourceImage(), 'reviews', {
      width: 8,
      height: 6,
      fit: 'inside',
      withoutEnlargement: true,
      format: 'webp'
    });

    const meta = await metadataOf(stored.url);
    expect([meta.width, meta.height]).toEqual([4, 4]);
  });

  it('strips directories and punctuation out of the caller-supplied name', async () => {
    const stored = await storeImage(await sourceImage(), 'products', { width: 8, height: 8 }, '../../etc/pa ss.png');

    expect(stored.filename).not.toContain('..');
    expect(stored.filename).not.toContain('/');
    expect(stored.url).toMatch(/^\/uploads\/products\/\d+-pa-ss\.webp$/);
    diskPathFor(stored.url);
  });

  it('keeps the order it was given', async () => {
    const buffer = await sourceImage();
    const stored = await storeImages(
      [
        { buffer, originalname: 'first.png' },
        { buffer, originalname: 'second.png' },
        { buffer, originalname: 'third.png' }
      ],
      'reviews',
      { width: 8, height: 8 }
    );

    expect(stored.map((image) => image.url.replace(/\/\d+-/, '/'))).toEqual([
      '/uploads/reviews/first.webp',
      '/uploads/reviews/second.webp',
      '/uploads/reviews/third.webp'
    ]);

    stored.forEach((image) => diskPathFor(image.url));
  });
});

describe('removeImage', () => {
  it('deletes a file the disk backend wrote', async () => {
    const stored = await storeImage(await sourceImage(), 'products', { width: 8, height: 8 });
    const absolute = diskPathFor(stored.url);

    expect(await removeImage(stored.url)).toBe(true);
    await expect(fs.access(absolute)).rejects.toThrow();
  });

  /**
   * Cleanup runs after the document that referenced the image is already
   * updated, so an image that has gone missing is not a reason to fail the
   * request the visitor is waiting on.
   */
  it('treats an already-absent file as success', async () => {
    expect(await removeImage('/uploads/products/never-existed.webp')).toBe(true);
  });

  it('does nothing with an empty value', async () => {
    expect(await removeImage('')).toBe(true);
  });
});
