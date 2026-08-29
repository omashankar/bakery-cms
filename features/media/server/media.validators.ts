import { z } from "zod";

/** Lenient array schemas for media files + folders; strict on identifiers. */

const mediaFileSchema = z
  .object({ id: z.string().min(1), url: z.string().min(1), name: z.string().default("") })
  .passthrough();

const mediaFolderSchema = z
  .object({ id: z.string().min(1), name: z.string().min(1) })
  .passthrough();

export const mediaFilesSchema = z.array(mediaFileSchema);
export const mediaFoldersSchema = z.array(mediaFolderSchema);

/**
 * A base64 image data URI — the shape the browser sends after reading a file.
 *
 * Deliberately `data:image/`, not `data:`: `data:text/html;base64,...` is a
 * perfectly valid data URI and Cloudinary would store it happily.
 */
const DATA_IMAGE_URI = /^data:image\/[a-z0-9.+-]+;base64,/i;

/**
 * What may be handed to Cloudinary as an upload source.
 *
 * This was `z.string().min(1)`, and that is a REMOTE FILE READ. The Cloudinary
 * SDK decides what a source is by pattern — `isRemoteUrl` matches only
 * ftp/http/https/gs/s3/data — and ANYTHING ELSE is treated as a path on this
 * server's disk (`fs.createReadStream(file)`, uploader.js:646) whose contents
 * come back as a public `secure_url` on a CDN.
 *
 * So a `source` of `D:\GitHub\bakery-cms\.env.local` published
 * MONGODB_URI, the three JWT secrets and CLOUDINARY_API_SECRET, behind nothing
 * but the owner/admin role a bakery hands its shop manager.
 *
 * Order matters: `new URL("data:image/png;base64,…").protocol` is `"data:"`,
 * so the data-URI case has to be answered BEFORE the https check, not after.
 *
 * And a Windows path is not caught by `new URL()` throwing — `D:\...` parses
 * with protocol `"d:"`, because a single letter is a valid URL scheme. The test
 * has to be that the protocol IS https, never merely that parsing failed.
 */
export const uploadSchema = z.object({
  source: z
    .string()
    .min(1, "An image is required")
    .refine(
      (value) => {
        if (DATA_IMAGE_URI.test(value)) return true;
        try {
          return new URL(value).protocol === "https:";
        } catch {
          return false;
        }
      },
      "Provide an uploaded image or an https:// image URL",
    ),
  folder: z.string().optional(),
});

/**
 * A media save, optionally naming the ids being deleted.
 *
 * Only ids listed here have their Cloudinary asset destroyed — see
 * media.service.replaceFiles. A bare array is still accepted so an older
 * client keeps working; it simply destroys nothing.
 */
export const mediaFilesPayloadSchema = z.union([
  mediaFilesSchema,
  z.object({ files: mediaFilesSchema, deletedIds: z.array(z.string()).default([]) }),
]);
