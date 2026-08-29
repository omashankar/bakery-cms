/**
 * Make a phone photograph small enough to upload over Indian mobile data.
 *
 * A modern phone camera writes 4000×3000 at 4–8 MB. The shop owner adding a
 * cake is usually standing in the shop on a phone, and that upload takes the
 * best part of a minute — long enough that people assume it has hung and press
 * the button again. Nothing on the site ever draws that image wider than about
 * 800 CSS pixels.
 *
 * Resizing in the browser BEFORE the upload turns ~6 MB into ~250 KB, so the
 * request finishes in a couple of seconds. Cloudinary would have resized it on
 * delivery anyway; what it cannot do is make the upload itself faster.
 */

/** Long edge, in pixels. Doubled for retina against the widest slot on the site. */
export const MAX_EDGE = 1600;

/** WebP quality. 0.82 is where re-encoding stops being visible on photographs. */
export const QUALITY = 0.82;

/** Below this, the round trip through a canvas costs more than it saves. */
export const ALREADY_SMALL_BYTES = 150 * 1024;

/**
 * Whether a file should be re-encoded at all.
 *
 * Two formats are excluded for reasons that are not about size:
 *  - SVG is vector. Rasterising a logo to 1600px throws away the one property
 *    that made it the right choice, and shop logos are the main SVGs here.
 *  - GIF may be animated, and a canvas keeps only the first frame. Silently
 *    turning an animation into a still is worse than a large file.
 */
export function shouldShrink(type: string, bytes: number): boolean {
  if (type === "image/svg+xml" || type === "image/gif") return false;
  if (!type.startsWith("image/")) return false;
  return bytes > ALREADY_SMALL_BYTES;
}

/** The size a photo becomes, preserving its aspect ratio. Never upscales. */
export function fittedSize(
  width: number,
  height: number,
  maxEdge = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  // Floored at 1: a very long thin strip rounds its short edge to 0, and a
  // canvas of height 0 throws rather than producing a small image.
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export interface ShrunkImage {
  /** A data URI, ready for the existing upload path. */
  dataUrl: string;
  bytes: number;
  /** False when the original was returned untouched, for any reason. */
  shrunk: boolean;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read image file"));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Resize a chosen file, falling back to the original whenever anything is not
 * as expected.
 *
 * Every failure path returns the original rather than throwing. A shop owner
 * whose browser lacks `createImageBitmap`, or whose photo decodes oddly, should
 * get a slow upload — not a refusal to add their cake.
 *
 * WebP rather than JPEG: it is materially smaller at the same quality AND it
 * keeps transparency, which matters because this same field sets shop logos.
 */
export async function shrinkImageFile(file: File): Promise<ShrunkImage> {
  const original = async (): Promise<ShrunkImage> => ({
    dataUrl: await readAsDataUrl(file),
    bytes: file.size,
    shrunk: false,
  });

  if (!shouldShrink(file.type, file.size)) return original();
  if (typeof createImageBitmap !== "function") return original();

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fittedSize(bitmap.width, bitmap.height);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return original();
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );

    /**
     * `toBlob` does NOT answer null for an unsupported type — the HTML spec
     * says the type is reset to `image/png` and a PNG is produced instead, so a
     * browser that cannot encode WebP silently hands back PNG. That is fine
     * here: the result is still a valid image data URI, still smaller than a
     * 4000px original, and the size comparison below is what actually decides
     * whether it is worth using. `null` means the canvas had no pixels.
     */
    if (!blob || blob.size >= file.size) return original();

    return { dataUrl: await readAsDataUrl(blob), bytes: blob.size, shrunk: true };
  } catch {
    return original();
  }
}
