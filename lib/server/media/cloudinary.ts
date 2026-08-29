import { v2 as cloudinary } from "cloudinary";

/**
 * Cloudinary integration for the media library.
 *
 * Credentials come from env (never the client): either a single `CLOUDINARY_URL`
 * (cloudinary://key:secret@cloud) or the three `CLOUDINARY_CLOUD_NAME` /
 * `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` vars. When unconfigured every
 * function degrades gracefully — `isConfigured()` is false and callers fall back
 * to storing the raw URL/data-URI (as the app did before), so the media library
 * keeps working until credentials are added.
 */

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let configured = false;

if (process.env.CLOUDINARY_URL) {
  // The SDK reads CLOUDINARY_URL automatically; a call is enough to validate it.
  cloudinary.config({ secure: true });
  configured = true;
} else if (cloudName && apiKey && apiSecret) {
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  configured = true;
}

export function isCloudinaryConfigured(): boolean {
  return configured;
}

export interface UploadedAsset {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}

/** Upload a data URI (or remote URL) to Cloudinary under the given folder. */
export async function uploadToCloudinary(
  source: string,
  folder = "bakery-cms",
): Promise<UploadedAsset> {
  if (!configured) throw new Error("Cloudinary is not configured");
  const result = await cloudinary.uploader.upload(source, {
    folder,
    /**
     * "image", not "auto".
     *
     * Both callers send an image and nothing else — the media library rejects a
     * file whose type is not image/*, and the photo-cake route sniffs the magic
     * number before it builds its data URI. "auto" let Cloudinary decide from
     * the bytes, which turned a source that was never an image into a stored
     * raw file rather than a refusal.
     */
    resource_type: "image",
    /**
     * The SDK's own default is a 60s socket timeout (uploader.js:635), and a
     * remote source means Cloudinary fetches a host WE do not control. A
     * pasted link to something slow otherwise holds this admin request open for
     * a minute.
     */
    timeout: 20000,
  });
  return {
    url: result.secure_url,
    publicId: result.public_id,
    width: result.width,
    height: result.height,
    bytes: result.bytes,
    format: result.format,
  };
}

/** Delete an asset by its Cloudinary public id. Best-effort — never throws. */
export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
  } catch {
    // A failed remote delete must not break the local delete.
  }
}
