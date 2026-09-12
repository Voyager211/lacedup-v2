/**
 * Cloudinary delivery URLs, resized and re-encoded on the way out.
 *
 * The images the site is art-directed with are originals: the About banner is
 * a 2752x1536 PNG weighing 7.8MB, and one hero slide is 2.3MB. Served as they
 * are, the first paint of two pages is dominated by artwork nobody can see the
 * detail of - a banner rendered 1600px wide does not need 2752px of it, and
 * none of them need PNG.
 *
 * Cloudinary will do both on request, so this is a URL change rather than a
 * re-upload: `f_auto` negotiates AVIF or WebP against the browser's Accept
 * header, `q_auto` picks a quality per image rather than a fixed number, and
 * `c_limit` caps the width without ever scaling a small source up. Together
 * they take the banner from 7.8MB to something in the low hundreds of KB.
 *
 * Anything that is not a Cloudinary upload URL is returned untouched, so this
 * is safe to apply to a product image that came from somewhere else.
 */

/** Matches the delivery URLs Cloudinary hands back, capturing either side of the insert point. */
const UPLOAD_URL = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload)\/(.+)$/;

export interface CloudinaryOptions {
  /** Largest width to deliver. The source is never upscaled past its own. */
  width: number;
  /** Overrides the automatic quality - only worth setting to force a lower one. */
  quality?: string;
}

/**
 * One transformed URL.
 *
 * Transformations are inserted directly after `/upload/`, which is where
 * Cloudinary looks for them, and before the version segment so that the public
 * id - and therefore the asset the URL resolves to - is unchanged.
 */
export const cloudinaryUrl = (url: string, { width, quality = 'auto' }: CloudinaryOptions): string => {
  const match = UPLOAD_URL.exec(url);
  if (!match) return url;

  const [, base, rest] = match;
  return `${base}/f_auto,q_${quality},c_limit,w_${width}/${rest}`;
};

/**
 * The widths offered to the browser for a full-bleed image.
 *
 * Stops at 2560 because that is the widest of these sources; asking for more
 * would return the same pixels under a different URL and split the cache.
 */
const SRCSET_WIDTHS = [640, 960, 1280, 1600, 1920, 2560];

/**
 * A `srcset` for a banner or slide, letting the browser pick by device pixel
 * ratio and viewport rather than every phone downloading the desktop artwork.
 *
 * Pair it with `sizes="100vw"`, which is true for every use of this so far -
 * all of them are full-bleed.
 *
 * It takes the same quality as `cloudinaryUrl` because it has to: once a srcset
 * is present the browser chooses from it and `src` is only the fallback, so a
 * quality set on one and not the other is a quality that never applies.
 */
export const cloudinarySrcSet = (
  url: string,
  { quality }: Pick<CloudinaryOptions, 'quality'> = {}
): string | undefined => {
  if (!UPLOAD_URL.test(url)) return undefined;

  return SRCSET_WIDTHS.map(
    (width) => `${cloudinaryUrl(url, { width, ...(quality ? { quality } : {}) })} ${width}w`
  ).join(', ');
};
