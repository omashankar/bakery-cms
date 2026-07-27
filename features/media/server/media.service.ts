import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  type UploadedAsset,
} from "@/lib/server/media/cloudinary";
import { defaultMediaFolders } from "@/apps/admin/media/lib/media-folders";
import type { MediaFile, MediaFolder } from "@/types/media";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

// Files seed empty: the admin client hydrates its richer local seed and populates
// the server on first save. Folders seed to the shipped defaults.
const filesStore = createMongoStore<MediaFile[]>({ key: "media-files", seed: () => [] });
const foldersStore = createMongoStore<MediaFolder[]>({
  key: "media-folders",
  seed: () => defaultMediaFolders,
});

export function getFiles() {
  return filesStore.read();
}

/**
 * Replace the media file list. Any previously-stored file that has a Cloudinary
 * `publicId` and is no longer present is deleted from Cloudinary too — the
 * delete-sync the prompt asks for.
 */
export async function replaceFiles(files: MediaFile[], ctx: RequestCtx) {
  const current = await filesStore.read();
  const keptIds = new Set(files.map((f) => f.id));
  const removed = current.filter((f) => f.publicId && !keptIds.has(f.id));

  await Promise.all(removed.map((f) => deleteFromCloudinary(f.publicId as string)));
  await filesStore.write(files);

  await writeAuditLog({
    action: "media.files.replace",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "media", id: "files" },
    metadata: { count: files.length, cloudinaryDeleted: removed.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return filesStore.read();
}

export function getFolders() {
  return foldersStore.read();
}

export async function replaceFolders(folders: MediaFolder[], ctx: RequestCtx) {
  await foldersStore.write(folders);
  await writeAuditLog({
    action: "media.folders.replace",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "media", id: "folders" },
    metadata: { count: folders.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return foldersStore.read();
}

export interface UploadResult extends UploadedAsset {
  configured: boolean;
}

/** Upload a data URI to Cloudinary. If unconfigured, signals a fallback. */
export async function uploadMedia(source: string, folder?: string): Promise<UploadResult | null> {
  if (!isCloudinaryConfigured()) return null;
  const asset = await uploadToCloudinary(source, folder);
  return { ...asset, configured: true };
}
