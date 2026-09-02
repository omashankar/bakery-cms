import { AppError, ValidationError } from "@/lib/server/http/errors";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
} from "@/lib/server/media/cloudinary";

/**
 * The photo a customer wants printed on a photo cake.
 *
 * There was a file input on the product page that did none of this: it kept the
 * file NAME in React state and nothing else. The file was never uploaded, the
 * name never reached the cart line or the order, and the bakery received an
 * order for a photo cake with no photo and no sign that one had been chosen —
 * after the customer had watched themselves attach it, seen "Selected:
 * birthday.jpg", and paid the photo surcharge.
 *
 * This is the smallest upload path that is safe to expose. Three limits, and
 * none of them are advisory:
 */

/** 6 MB. Big enough for a phone photo, small enough not to be a storage attack. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * What a photo cake can actually be printed from.
 *
 * Checked by MAGIC BYTES, not by the `type` the browser reports — that field is
 * chosen by the client and an SVG or an HTML file announcing itself as
 * `image/png` would otherwise be stored and later served from the shop's own
 * media host.
 */
const SIGNATURES: { mime: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    mime: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

function sniff(bytes: Uint8Array): string | null {
  return SIGNATURES.find((signature) => signature.test(bytes))?.mime ?? null;
}

/** Every refusal here is about the same field, so the shape is stated once. */
function photoError(message: string): ValidationError {
  return new ValidationError([{ field: "photo", message }], message);
}

export interface UploadedPhoto {
  url: string;
  bytes: number;
}

/**
 * Store one customer photo and return a URL the order can carry.
 *
 * `folder` keeps these out of the shop's Media library: they are one
 * customer's private photograph attached to one order, not stock the admin
 * browses and reuses.
 */
export async function uploadPhotoCakeImage(file: File): Promise<UploadedPhoto> {
  if (file.size === 0) throw photoError("That file is empty");
  if (file.size > MAX_BYTES) {
    throw photoError(
      `That photo is too large. Please use an image under ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Re-checked against the bytes we actually received, because `file.size` is
  // reported by the same client that chose the file.
  if (buffer.byteLength > MAX_BYTES) {
    throw photoError("That photo is too large.");
  }

  const mime = sniff(new Uint8Array(buffer.subarray(0, 16)));
  if (!mime) {
    throw photoError("That file is not a JPEG, PNG or WebP image.");
  }

  if (!isCloudinaryConfigured()) {
    /**
     * Refused rather than stored some other way.
     *
     * The alternative the media library falls back to is keeping the raw data
     * URI in the database — which for a 6 MB photograph means a 8 MB string on
     * an order document, sent to every admin screen that lists orders. And a
     * customer told "photo attached" whose photo lives nowhere the bakery can
     * open is the exact failure this endpoint exists to end.
     */
    throw new AppError(
      "Photo uploads are not set up on this shop yet. Please place the order and the store will contact you for the photo.",
      503,
    );
  }

  const asset = await uploadToCloudinary(
    `data:${mime};base64,${buffer.toString("base64")}`,
    "bakery-cms/photo-cakes",
  );

  return { url: asset.url, bytes: asset.bytes ?? buffer.byteLength };
}
