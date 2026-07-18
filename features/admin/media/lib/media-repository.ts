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
import { fileNameFromUrl, isPersistableMediaUrl } from "./media-utils";

const STORAGE_KEY = "bakery-cms-media-library";
const STORAGE_VERSION_KEY = "bakery-cms-media-library-version";
const MEDIA_LIBRARY_VERSION = 6;

export const MEDIA_UPDATED_EVENT = "bakery-media-updated";

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

function repairMediaLibrary(existing: MediaFile[]): MediaFile[] {
  const freshSeed = seedMedia();
  const userFiles = existing.filter((file) => !file.id.startsWith("media-seed-"));
  const { files: normalizedUsers } = normalizeMediaFiles(userFiles);
  return dedupeByUrl([...normalizedUsers, ...freshSeed]);
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
    persistMedia(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as MediaFile[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedMedia();
      persistMedia(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 1);

    if (storedVersion < MEDIA_LIBRARY_VERSION) {
      const repaired = repairMediaLibrary(parsed);
      persistMedia(repaired);
      localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
      return repaired;
    }

    const { files: normalized, changed } = normalizeMediaFiles(parsed);

    if (changed) {
      persistMedia(normalized);
    }

    return normalized;
  } catch {
    const seeded = seedMedia();
    persistMedia(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(MEDIA_LIBRARY_VERSION));
    return seeded;
  }
}

function persistMedia(files: MediaFile[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function saveMediaFiles(files: MediaFile[]): void {
  persistMedia(files);
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

export function addMediaFile(
  file: Omit<MediaFile, "id" | "createdAt" | "updatedAt">,
  folderId = UPLOADS_FOLDER_ID
): MediaFile {
  const files = loadMediaFiles();
  const timestamp = nowIso();
  const created: MediaFile = {
    ...file,
    folderId: file.folderId ?? folderId,
    id: `media-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persistMedia([created, ...files]);
  notifyMediaUpdated();
  return created;
}

export function updateMediaFile(id: string, patch: Partial<MediaFile>): MediaFile | null {
  const files = loadMediaFiles();
  const index = files.findIndex((file) => file.id === id);
  if (index === -1) return null;

  const updated: MediaFile = {
    ...files[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  files[index] = updated;
  persistMedia(files);
  notifyMediaUpdated();
  return updated;
}

export function bulkMoveMediaToFolder(ids: string[], folderId: string): number {
  const files = loadMediaFiles();
  let count = 0;
  const next = files.map((file) => {
    if (!ids.includes(file.id)) return file;
    count += 1;
    return { ...file, folderId, updatedAt: nowIso() };
  });
  if (count > 0) {
    persistMedia(next);
    notifyMediaUpdated();
  }
  return count;
}

export function deleteMediaFiles(ids: string[]): number {
  const files = loadMediaFiles();
  const next = files.filter((file) => !ids.includes(file.id));
  const count = files.length - next.length;
  persistMedia(next);
  if (count > 0) notifyMediaUpdated();
  return count;
}

export { countMediaUsage, getMediaUsageDetails } from "./media-usage";
