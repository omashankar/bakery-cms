import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import {
  isCloudinaryConfigured,
  uploadToCloudinary,
  deleteFromCloudinary,
  type UploadedAsset,
} from "@/lib/server/media/cloudinary";
import { defaultMediaFolders } from "@/features/media/lib/media-folder-defaults";
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
/**
 * Ids deleted from the library, newest last — so a tab that still holds one
 * cannot put it back. Ids are `media-<timestamp>` and never reused.
 */
const deletedStore = createMongoStore<string[]>({ key: "media-deleted", seed: () => [] });
const DELETED_KEPT = 2000;

const foldersStore = createMongoStore<MediaFolder[]>({
  key: "media-folders",
  seed: () => defaultMediaFolders,
});

export function getFiles() {
  return filesStore.read();
}

/**
 * Replace the media file list.
 *
 * Cloudinary assets are destroyed only for ids the caller NAMES as deleted, not
 * for anything merely absent from the incoming list.
 *
 * This used to compute `removed` as "stored, has a publicId, not in the new
 * list" and destroy every one of them. That made a replace-all — which is what
 * renaming a file, moving it to a folder or editing alt text sends — into an
 * instruction to delete remote assets. Two admin tabs were enough: tab A uploads
 * three photos, tab B (hydrated before those uploads) edits one alt text, and
 * B's whole stale list arrives with A's three files absent, so all three are
 * destroyed at Cloudinary. Every product, banner and section pointing at them
 * renders a broken image, and there is nothing to restore.
 *
 * A list replacement is a statement about the list. Deleting an asset is a
 * separate intention, so it travels separately.
 */
export async function replaceFiles(
  files: MediaFile[],
  ctx: RequestCtx,
  deletedIds: string[] = [],
) {
  const incomingIds = new Set(files.map((f) => f.id));
  // A confused caller naming an id it also kept loses nothing.
  const deleting = deletedIds.filter((id) => !incomingIds.has(id));
  const gone = await rememberDeleted(deleting);

  let removed: MediaFile[] = [];
  await filesStore.mutate((current) => {
    removed = current.filter((f) => f.publicId && deleting.includes(f.id));
    return { next: mergeFiles(current, files, gone), result: undefined };
  });

  await Promise.all(removed.map((f) => deleteFromCloudinary(f.publicId as string)));

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

/**
 * Add files to the library without touching what is already in it.
 *
 * For someone who may upload but not curate (see MEDIA_CONTRIBUTORS): the
 * stored files are kept exactly as stored and only ids the library does not
 * have yet are appended. Nothing is ever destroyed on Cloudinary from here.
 */
export async function addFiles(files: MediaFile[], ctx: RequestCtx) {
  const gone = new Set(await deletedStore.read());
  const added = await filesStore.mutate((current) => {
    const known = new Set(current.map((f) => f.id));
    const fresh = files.filter((f) => !known.has(f.id) && !gone.has(f.id));
    return { next: fresh.length ? [...current, ...fresh] : current, result: fresh };
  });
  if (added.length === 0) return filesStore.read();
  await writeAuditLog({
    action: "media.files.add",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "media", id: "files" },
    metadata: { added: added.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return filesStore.read();
}

/**
 * WHAT A REPLACE-ALL MEANS WHEN THE SENDER'S COPY IS OLD.
 *
 * The browser sends its whole list. A tab opened before another admin's
 * uploads sent a list without them, and writing it as-is took those uploads
 * out of the library — their pictures still on Cloudinary and on the products
 * using them, but no longer in the library to pick, rename or delete. A file
 * deleted in one tab came back from the other, as a broken image.
 *
 * So the list is merged, not written:
 *   - a file only the server has is kept: absence is not deletion (deleting
 *     travels as `deletedIds`);
 *   - a file both have keeps whichever copy was changed last — every edit
 *     stamps `updatedAt`, and a stale tab's untouched copy is older;
 *   - a file deleted anywhere stays deleted.
 */
export function mergeFiles(current: MediaFile[], incoming: MediaFile[], gone: Set<string>): MediaFile[] {
  const stored = new Map(current.map((f) => [f.id, f]));
  const incomingIds = new Set(incoming.map((f) => f.id));
  const merged = incoming
    .filter((f) => !gone.has(f.id))
    .map((f) => {
      const mine = stored.get(f.id);
      return mine && (mine.updatedAt ?? "") > (f.updatedAt ?? "") ? mine : f;
    });
  const onlyStored = current.filter((f) => !incomingIds.has(f.id) && !gone.has(f.id));
  return [...onlyStored, ...merged];
}

/** Add `ids` to the deleted list; answers the whole list as a set. */
async function rememberDeleted(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set(await deletedStore.read());
  const all = await deletedStore.mutate((current) => {
    const next = [...current.filter((id) => !ids.includes(id)), ...ids].slice(-DELETED_KEPT);
    return { next, result: next };
  });
  return new Set(all);
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
