import {
  categories,
  galleryImages,
  specialOffers,
  testimonials,
} from "@/constants/landing-data";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { getAllProducts } from "@/features/products/lib/product-catalog";
import type { MediaFile } from "@/types/media";
import {
  BANNERS_FOLDER_ID,
  CAKES_FOLDER_ID,
  GALLERY_FOLDER_ID,
  UPLOADS_FOLDER_ID,
} from "./media-folders";
import { countMediaUsage } from "./media-usage";
import { fileNameFromUrl, isPersistableMediaUrl, MEDIA_UPDATED_EVENT } from "./media-utils";
import { mediaHydration, replaceMediaFilesRequest } from "./media-api";
import type { WriteResult } from "@/lib/write-result";

const STORAGE_KEY = "bakery-cms-media-library";
const STORAGE_VERSION_KEY = "bakery-cms-media-library-version";
const MEDIA_LIBRARY_VERSION = 6;

export { MEDIA_UPDATED_EVENT } from "./media-utils";

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function notifyMediaUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MEDIA_UPDATED_EVENT));
}

function collectSeedUrls(): string[] {
  const urls = new Set<string>();

  galleryImages.forEach((url) => urls.add(fixBrokenImageUrl(url)));
  getAllProducts().forEach((cake) => urls.add(fixBrokenImageUrl(cake.image)));
  categories.forEach((category) => urls.add(fixBrokenImageUrl(category.image)));
  specialOffers.forEach((offer) => urls.add(fixBrokenImageUrl(offer.image)));
  testimonials.forEach((item) => urls.add(fixBrokenImageUrl(item.avatar)));

  return Array.from(urls);
}

function inferSeedFolder(url: string): string {
  if (galleryImages.includes(url)) return GALLERY_FOLDER_ID;
  if (specialOffers.some((offer) => fixBrokenImageUrl(offer.image) === url)) {
    return BANNERS_FOLDER_ID;
  }
  if (getAllProducts().some((cake) => fixBrokenImageUrl(cake.image) === url)) {
    return CAKES_FOLDER_ID;
  }
  return GALLERY_FOLDER_ID;
}

function normalizeMediaFiles(files: MediaFile[]): { files: MediaFile[]; changed: boolean } {
  let changed = false;

  const next = files
    .map((file) => {
      if (!isPersistableMediaUrl(file.url)) {
        changed = true;
        return null;
      }

      const fixedUrl = fixBrokenImageUrl(file.url);
      const folderId = file.folderId ?? (file.id.startsWith("media-seed-") ? inferSeedFolder(fixedUrl) : UPLOADS_FOLDER_ID);
      const needsTags = file.tags === undefined;
      const needsCaption = file.caption === undefined;

      if (fixedUrl === file.url && folderId === file.folderId && !needsTags && !needsCaption) {
        return file;
      }

      changed = true;
      return {
        ...file,
        url: fixedUrl,
        name: fileNameFromUrl(fixedUrl),
        folderId,
        tags: file.tags ?? [],
        caption: file.caption ?? "",
        updatedAt: nowIso(),
      };
    })
    .filter((file): file is MediaFile => file !== null);

  if (next.length !== files.length) changed = true;

  return { files: next, changed };
}

function dedupeByUrl(files: MediaFile[]): MediaFile[] {
  const seen = new Set<string>();
  return files.filter((file) => {
    if (seen.has(file.url)) return false;
    seen.add(file.url);
    return true;
  });
}

/**
 * Bring a stored library up to the current version.
 *
 * This used to append the WHOLE fresh seed — `[...userFiles, ...freshSeed]` —
 * so every version bump reinstated every demo file the admin had deleted, and
 * kept doing it on each future bump. A migration exists to repair what the shop
 * has, not to reverse its decisions.
 *
 * A seed file the shop still holds is refreshed from the current seed (that is
 * what the migration is for: the shipped image URLs changed). One it deleted
 * stays deleted.
 */
function repairMediaLibrary(existing: MediaFile[]): MediaFile[] {
  const fresh = new Map(seedMedia().map((file) => [file.id, file]));
  const repaired = existing.map((file) =>
    file.id.startsWith("media-seed-") ? fresh.get(file.id) ?? file : file,
  );
  const { files: normalized } = normalizeMediaFiles(repaired);
  return dedupeByUrl(normalized);
}

function seedMedia(): MediaFile[] {
  return collectSeedUrls().map((url, index) => ({
    id: `media-seed-${index + 1}`,
    name: fileNameFromUrl(url),
    url,
    type: "image" as const,
    mimeType: "image/jpeg",
    size: 180_000 + index * 12_400,
    alt: "",
    caption: "",
    tags: [],
    width: index % 2 === 0 ? 1200 : 800,
    height: index % 3 === 0 ? 1000 : 800,
    folderId: inferSeedFolder(url),
    createdAt: daysAgo(index % 28),
    updatedAt: daysAgo(index % 14),
  }));
}

export function loadMediaFiles(): MediaFile[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    const seeded = seedMedia();
    lowPersistMedia(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as MediaFile[];
    // An empty library is an ANSWER, not a missing one.
    //
    // This re-seeded roughly forty demo files whenever the stored array was
    // empty, so an admin who cleared the library got the whole demo set back on
    // the next load. Writing the re-seed locally did not contain it: every
    // mutation here is a replace-all that sends the whole list, so their next
    // upload pushed the demo library to the server as well. Only a missing or
    // unreadable value seeds.
    if (!Array.isArray(parsed)) {
      const seeded = seedMedia();
      lowPersistMedia(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);

    if (storedVersion < MEDIA_LIBRARY_VERSION) {
      const repaired = repairMediaLibrary(parsed);
      lowPersistMedia(repaired);
      localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
      return repaired;
    }

    const { files: normalized, changed } = normalizeMediaFiles(parsed);

    if (changed) {
      lowPersistMedia(normalized);
    }

    return normalized;
  } catch {
    const seeded = seedMedia();
    lowPersistMedia(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
    return seeded;
  }
}

/** Local-only write. Used by the seed/repair/normalize paths (no dual-write). */
function lowPersistMedia(files: MediaFile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

/**
 * Mutation write: local + best-effort server replace-all (which delete-syncs
 * removed Cloudinary assets). Note: with Cloudinary configured, uploads store
 * small URLs; the graceful-degrade path stores data URIs, so avoid a very large
 * library of un-uploaded images (a Mongo document is capped at 16MB).
 */
async function persistMedia(
  files: MediaFile[],
  deletedIds: string[] = [],
): Promise<boolean> {
  lowPersistMedia(files);
  return replaceMediaFilesRequest(files, deletedIds);
}

/**
 * The library, but only once the server's copy is in it.
 *
 * Every mutator here read `loadMediaFiles()` SYNCHRONOUSLY and only then
 * awaited — the gate lives inside `replaceMediaFilesRequest`, which holds the
 * request but is handed a body that was already frozen. And `loadMediaFiles`
 * SEEDS when the key is absent, which on a first admin visit it is: roughly
 * forty demo records, one per URL in `collectSeedUrls()`. So an upload in the
 * first second of a page load composed `[created, ...demoSeed]`, the sync
 * settled the gate a moment later, the queued PUT was released, and
 * `replaceFiles` wrote it whole over the shop's real library — with the
 * `deletedIds` of that same request authorising Cloudinary deletions.
 *
 * This is the mistake `readHydratedCoupons` was written for, in the file whose
 * comment says it plainly: the gate has to guard the READ, not the write.
 *
 * `null` means hydration never settled, and then nothing is sent at all.
 */
async function readHydratedMedia(): Promise<MediaFile[] | null> {
  if (!(await mediaHydration.waitForSettled())) return null;
  return loadMediaFiles();
}

export async function saveMediaFiles(files: MediaFile[]): Promise<boolean> {
  const persisted = await persistMedia(files);
  notifyMediaUpdated();
  return persisted;
}

/**
 * Hydration: write the server's media files into the local cache (no re-push).
 *
 * It used to return early on an empty server list, to protect the local seed on
 * a first run. That made an emptied library impossible to synchronise: admin A
 * deletes every file, admin B opens the library on another device, the fetch
 * returns `[]`, this bailed, and B kept the whole stale list on screen. B's next
 * save then PUT that list back — restoring records whose Cloudinary assets the
 * delete had already destroyed, so the library filled with permanently broken
 * images. An empty server list is the server's answer and is written like any
 * other.
 */
export function persistServerMedia(files: MediaFile[]): void {
  lowPersistMedia(files);
  notifyMediaUpdated();
}

export function getMediaStats(files: MediaFile[] = loadMediaFiles()) {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const unused = files.filter((file) => countMediaUsage(file.url) === 0).length;

  return {
    total: files.length,
    images: files.filter((file) => file.type === "image").length,
    videos: files.filter((file) => file.type === "video").length,
    totalBytes,
    unused,
  };
}

export async function addMediaFile(
  file: Omit<MediaFile, "id" | "createdAt" | "updatedAt">,
  folderId = UPLOADS_FOLDER_ID
): Promise<WriteResult<MediaFile>> {
  const files = await readHydratedMedia();
  const timestamp = nowIso();
  const created: MediaFile = {
    ...file,
    folderId: file.folderId ?? folderId,
    id: `media-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  // The upload itself still happened; only the library write is refused, and
  // `persisted: false` is what the caller reports.
  if (files === null) return { value: created, persisted: false };

  const persisted = await persistMedia([created, ...files]);
  notifyMediaUpdated();
  return { value: created, persisted };
}

export async function updateMediaFile(
  id: string,
  patch: Partial<MediaFile>
): Promise<WriteResult<MediaFile | null>> {
  const files = await readHydratedMedia();
  if (files === null) return { value: null, persisted: false };
  const index = files.findIndex((file) => file.id === id);
  if (index === -1) return { value: null, persisted: false };

  const updated: MediaFile = {
    ...files[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  files[index] = updated;
  const persisted = await persistMedia(files);
  notifyMediaUpdated();
  return { value: updated, persisted };
}

export async function bulkMoveMediaToFolder(
  ids: string[],
  folderId: string
): Promise<WriteResult<number>> {
  const files = await readHydratedMedia();
  if (files === null) return { value: 0, persisted: false };
  let count = 0;
  const next = files.map((file) => {
    if (!ids.includes(file.id)) return file;
    count += 1;
    return { ...file, folderId, updatedAt: nowIso() };
  });
  // Nothing moved means nothing was sent, so nothing could fail to persist.
  if (count === 0) return { value: 0, persisted: true };

  const persisted = await persistMedia(next);
  notifyMediaUpdated();
  return { value: count, persisted };
}

/**
 * Reassign every file in one folder to another. Returns how many moved.
 *
 * Used when a folder is deleted, so its files land somewhere real instead of
 * pointing at a folder that no longer exists.
 */
export async function moveFilesToFolder(fromId: string, toId: string): Promise<number> {
  const files = await readHydratedMedia();
  if (files === null) return 0;
  const affected = files.filter((file) => file.folderId === fromId);
  if (affected.length === 0) return 0;

  const next = files.map((file) =>
    file.folderId === fromId ? { ...file, folderId: toId, updatedAt: nowIso() } : file,
  );
  await persistMedia(next);
  notifyMediaUpdated();
  return affected.length;
}

export async function deleteMediaFiles(ids: string[]): Promise<WriteResult<number>> {
  const files = await readHydratedMedia();
  if (files === null) return { value: 0, persisted: false };
  const next = files.filter((file) => !ids.includes(file.id));
  const count = files.length - next.length;
  // Naming them is what authorises destroying their Cloudinary assets.
  const persisted = await persistMedia(next, ids);
  if (count > 0) notifyMediaUpdated();
  return { value: count, persisted };
}

export {
  countMediaUsage,
  getMediaUsageDetails,
  isUsageIndexReady,
} from "./media-usage";
