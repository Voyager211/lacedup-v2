import { cn } from '@/lib/cn';

/**
 * The LacedUp wordmark.
 *
 * Two assets, both hosted on Cloudinary and both **white artwork on a
 * transparent background** - the user one is greyscale white, the admin one is
 * white with a blue "Admin" badge. That matters for placement:
 *
 *  - On a dark surface they read as-is. Pass `onDark`.
 *  - On a light surface the user mark is inverted to black, which is exact
 *    because the artwork is greyscale. The admin mark is *not* inverted -
 *    inverting would turn its blue badge orange - so light-background callers
 *    give it a dark plate instead (see AdminLoginPage).
 *
 * The URLs carry Cloudinary transforms rather than pointing at the originals.
 * The admin source is 3194x1312 and 2.8MB; `f_auto,q_auto,w_320` serves it as
 * 6.8KB, and picks WebP or AVIF per browser. Never link the raw asset.
 */

const BASE = 'https://res.cloudinary.com/daqfxkc3u/image/upload';

const SOURCES = {
  user: 'v1758736515/laceduplogoblackbg_xtbahr__2_-removebg-preview_pngcmi.png',
  admin: 'v1786741898/Gemini_Generated_Image_9s19vp9s19vp9s197_tvqxi9.png'
} as const;

/** Intrinsic aspect ratios, so the box is reserved before the image lands. */
const RATIO = {
  user: 759 / 329,
  admin: 3194 / 1312
} as const;

export type LogoVariant = keyof typeof SOURCES;

export interface LogoProps {
  variant?: LogoVariant;
  /** The logo sits on a dark surface, so the white artwork is left alone. */
  onDark?: boolean;
  /** Rendered width in CSS pixels. Requests roughly 2x for retina. */
  width?: number;
  className?: string;
}

const Logo = ({ variant = 'user', onDark = false, width = 150, className }: LogoProps) => {
  const src = `${BASE}/f_auto,q_auto,w_${Math.round(width * 2)}/${SOURCES[variant]}`;

  return (
    <img
      src={src}
      alt="LacedUp"
      width={width}
      height={Math.round(width / RATIO[variant])}
      // Above the fold on every page that uses it, so no lazy loading.
      decoding="async"
      className={cn(
        'block h-auto object-contain',
        // Greyscale white -> black. Only correct for the user mark; the admin
        // mark keeps its blue badge and is given a dark plate by its caller.
        !onDark && variant === 'user' && 'invert',
        className
      )}
      style={{ width }}
    />
  );
};

export default Logo;
