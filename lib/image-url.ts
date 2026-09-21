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

/** `?w=600&h=600&fit=crop` — the size Unsplash was asked for, if it was. */
const UNSPLASH = /^https:\/\/images\.unsplash\.com\//;

/**
 * THE SAME PHOTOGRAPH, BIG ENOUGH TO BE MAGNIFIED.
 *
 * The product page's hover panel shows a slice of the picture at two and a half
 * times its drawn size. The picture it had to work with was the one the page
 * renders — and on this shop that is 600 pixels from Unsplash or 736 from
 * Cloudinary. Measured: the panel is 416 CSS pixels wide, which is 832 device
 * pixels on the phones and laptops these customers use, and it was filling them
 * from a 240-pixel slice. A 3.47x upscale is not a closer look at anything; it
 * is the same photograph with its edges smeared, shown at the exact moment a
 * customer is trying to decide whether to trust it.
 *
 * So the panel asks for a bigger file than the page does. Only the panel, and
 * only when somebody actually hovers — the `<img>` on the page keeps its small,
 * fast version, and a visitor who never magnifies never pays for this.
 *
 * TWO HOSTS, AND NOTHING ELSE. Cloudinary is the shop's own uploads and goes
 * through `optimizedImageUrl`. Unsplash is where the shipped demo photographs
 * live, and its URLs ALREADY carry `w=` and `h=` — rewriting numbers that are
 * demonstrably there and working is not the same as guessing at a CDN's API,
 * which is what the rest of this file refuses to do. Any other host is returned
 * untouched and the panel simply shows what the page already had.
 */
export function magnifiableImageUrl(url: string, width = 2000): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return trimmed;

  if (UNSPLASH.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      // Only when a size is already being asked for. A bare Unsplash URL is
      // the full-resolution original and needs nothing.
      if (!parsed.searchParams.has("w") && !parsed.searchParams.has("h")) return trimmed;
      parsed.searchParams.set("w", String(width));
      if (parsed.searchParams.has("h")) parsed.searchParams.set("h", String(width));
      return parsed.toString();
    } catch {
      return trimmed;
    }
  }

  /*
    `width / 2`, because `optimizedImageUrl` doubles what it is given for
    retina — passing the figure we actually want would ask Cloudinary for twice
    it and make the shop pay for pixels no screen resolves.
  */
  return optimizedImageUrl(trimmed, { width: Math.round(width / 2) });
}
