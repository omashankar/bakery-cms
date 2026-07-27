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

export const uploadSchema = z.object({
  /** A data URI (data:image/...;base64,...) or a remote image URL. */
  source: z.string().min(1, "An image is required"),
  folder: z.string().optional(),
});
