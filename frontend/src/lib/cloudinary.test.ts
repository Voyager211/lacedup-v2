import { describe, expect, it } from 'vitest';
import { cloudinarySrcSet, cloudinaryUrl } from './cloudinary';

const BASE = 'https://res.cloudinary.com/daqfxkc3u/image/upload';
const BANNER = `${BASE}/v1770038257/Untitled_design_cf3awo.png`;

describe('cloudinaryUrl', () => {
  it('inserts the transform between /upload/ and the version', () => {
    expect(cloudinaryUrl(BANNER, { width: 1600 })).toBe(
      `${BASE}/f_auto,q_auto,c_limit,w_1600/v1770038257/Untitled_design_cf3awo.png`
    );
  });

  /**
   * The public id has to survive untouched: it is the only thing identifying
   * the asset, and a transform that landed on the wrong side of the version
   * would resolve to nothing.
   */
  it('leaves the version and public id alone', () => {
    const result = cloudinaryUrl(BANNER, { width: 640 });

    expect(result).toContain('/v1770038257/Untitled_design_cf3awo.png');
    expect(result.endsWith('Untitled_design_cf3awo.png')).toBe(true);
  });

  it('honours an explicit quality', () => {
    expect(cloudinaryUrl(BANNER, { width: 800, quality: '60' })).toContain('q_60');
  });

  /**
   * c_limit rather than a plain resize, so a source narrower than the
   * requested width is delivered as-is instead of being blown up.
   */
  it('never upscales', () => {
    expect(cloudinaryUrl(BANNER, { width: 2560 })).toContain('c_limit');
  });

  /**
   * c_pad fits the whole image inside the ratio and fills the remainder, which
   * is what stops a source shaped differently from its box losing an edge.
   * c_limit would leave the shape alone and let CSS crop it instead.
   */
  it('pads to an aspect ratio when one is asked for, rather than limiting', () => {
    const padded = cloudinaryUrl(BANNER, { width: 1920, aspectRatio: '16:9' });

    expect(padded).toContain('c_pad,ar_16:9,b_black');
    expect(padded).not.toContain('c_limit');
  });

  it('limits without changing shape when no ratio is given', () => {
    expect(cloudinaryUrl(BANNER, { width: 1920 })).toContain('c_limit');
  });

  it('passes through anything that is not a Cloudinary upload URL', () => {
    for (const url of ['/uploads/products/local.webp', 'https://example.com/a.png', '']) {
      expect(cloudinaryUrl(url, { width: 800 })).toBe(url);
    }
  });
});

describe('cloudinarySrcSet', () => {
  /**
   * Each descriptor has to match the width actually requested in its URL. If
   * they drift, the browser picks by a number the bytes do not honour and
   * either fetches artwork too small for the screen or too large for it.
   */
  it('offers each width with a descriptor that matches its URL', () => {
    const entries = cloudinarySrcSet(BANNER)!.split(', ');

    expect(entries).toHaveLength(6);

    for (const entry of entries) {
      const [url, descriptor] = entry.split(' ');

      expect(descriptor).toMatch(/^\d+w$/);
      expect(url).toContain(`w_${descriptor!.slice(0, -1)}/`);
    }
  });

  it('starts at a phone-sized width and stops at the largest source', () => {
    const srcSet = cloudinarySrcSet(BANNER)!;

    expect(srcSet).toContain('w_640');
    expect(srcSet).toContain('w_2560');
    expect(srcSet).not.toContain('w_3840');
  });

  /**
   * A srcset wins over src, so a quality applied only to src would never
   * actually be used. Every candidate has to carry it.
   */
  it('carries an explicit quality into every candidate', () => {
    const entries = cloudinarySrcSet(BANNER, { quality: 'auto:eco' })!.split(', ');

    for (const entry of entries) {
      expect(entry).toContain('q_auto:eco');
    }
  });

  it('defaults to automatic quality when none is given', () => {
    expect(cloudinarySrcSet(BANNER)).toContain('q_auto,');
    expect(cloudinarySrcSet(BANNER)).not.toContain('q_auto:');
  });

  /** Undefined rather than a broken srcSet, so the caller can omit the attribute. */
  it('returns undefined for a non-Cloudinary URL', () => {
    expect(cloudinarySrcSet('/uploads/products/local.webp')).toBeUndefined();
  });
});
