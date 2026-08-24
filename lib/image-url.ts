/**
 * Ask Cloudinary for the size the page actually renders.
 *
 * Images uploaded through the Media Library are delivered from Cloudinary at
 * whatever dimensions the shop exported them, and shops export logos the size
 * their designer handed over. Measured on this install: a 1254x1254 favicon at
 * 489 KB, drawn 16px wide in a browser tab, on every page of the site — heavier
 * on its own than every script the page loads, gzipped. The wordmark was 293 KB
 * for a 50px-tall header mark.
 *
 * Cloudinary resizes and re-encodes on delivery, from a transformation segment
 * in the path, and caches the result. `f_auto` picks AVIF or WebP by what the
 * requesting browser accepts; `q_auto` picks a quality by what the image is.
 * Neither changes the stored original, so a shop that later wants the full-size
 * file still has it — and nobody has to re-export anything.
 *
 * Any other host is returned untouched: an admin may type a URL anywhere, and
 * guessing at another CDN's parameters would produce a broken image rather than
 * a smaller one.
 */

/** `https://res.cloudinary.com/<cloud>/image/upload/` — everything before the transformation slot. */
const CLOUDINARY_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/;

export interface ImageSizeHint {
  /** Rendered width in CSS pixels, before the retina multiplier. */
  width?: number;
  /** Rendered height in CSS pixels, before the retina multiplier. */
  height?: number;
}

export function optimizedImageUrl(url: string, size: ImageSizeHint = {}): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return trimmed;

  const match = CLOUDINARY_UPLOAD.exec(trimmed);
  if (!match) return trimmed;

  const [, prefix, rest] = match;

  /**
   * Already transformed — leave it alone.
   *
   * A version segment is `v` plus digits; anything else in the first segment is
   * a transformation the caller (or the admin) put there deliberately. Stacking
   * a second one is not wrong for Cloudinary, but it makes the stored URL and
   * the delivered URL drift apart for no gain.
   */
  const firstSegment = rest.split("/")[0] ?? "";
  if (firstSegment && !/^v\d+$/.test(firstSegment)) return trimmed;

  // Doubled for retina. A 50px-tall mark asks for 100px and stays sharp on the
  // phones most of these shops' customers are on.
  const parts = ["f_auto", "q_auto"];
  if (size.width) parts.push(`w_${Math.round(size.width * 2)}`);
  if (size.height) parts.push(`h_${Math.round(size.height * 2)}`);
  if (size.width || size.height) parts.push("c_limit");

  return `${prefix}${parts.join(",")}/${rest}`;
}
