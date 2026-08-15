import { cn } from '@/lib/cn';

/**
 * The LacedUp wordmark.
 *
 * One asset, hosted on Cloudinary: **white artwork on a transparent
 * background**, greyscale throughout.
 *
 *  - On a dark surface it reads as-is. Pass `onDark`.
 *  - On a light surface it is inverted to black, which is exact rather than
 *    approximate precisely because the artwork is greyscale.
 *
 * The admin panel used to have a mark of its own, white with a blue badge
 * baked into the image. It is gone: one brand, one wordmark, and the panel
 * says which side of the app you are on with a badge beside it - which is
 * legible at any size, unlike text inside a raster.
 *
 * The URL carries Cloudinary transforms rather than pointing at the original.
 * `f_auto,q_auto,w_320` serves a few kilobytes and picks WebP or AVIF per
 * browser. Never link the raw asset.
 */

const BASE = 'https://res.cloudinary.com/daqfxkc3u/image/upload';

const SOURCE = 'v1758736515/laceduplogoblackbg_xtbahr__2_-removebg-preview_pngcmi.png';

/** Intrinsic aspect ratio, so the box is reserved before the image lands. */
const RATIO = 759 / 329;

export interface LogoProps {
  /** The logo sits on a dark surface, so the white artwork is left alone. */
  onDark?: boolean;
  /** Rendered width in CSS pixels. Requests roughly 2x for retina. */
  width?: number;
  className?: string;
}

const Logo = ({ onDark = false, width = 150, className }: LogoProps) => {
  const src = `${BASE}/f_auto,q_auto,w_${Math.round(width * 2)}/${SOURCE}`;

  return (
    <img
      src={src}
      alt="LacedUp"
      width={width}
      height={Math.round(width / RATIO)}
      // Above the fold on every page that uses it, so no lazy loading.
      decoding="async"
      className={cn('block h-auto object-contain', !onDark && 'invert', className)}
      style={{ width }}
    />
  );
};

export default Logo;
