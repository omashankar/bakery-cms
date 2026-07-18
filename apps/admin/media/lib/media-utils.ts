import type { MediaFile, MediaType } from "@/types/media";
import { fixBrokenImageUrl } from "@/constants/demo-images";
import { countMediaUsage } from "./media-usage";

/** Resolve a stored media URL for display (fixes legacy dead Unsplash links) */
export function resolveMediaImageUrl(url: string): string {
  if (!url) return url;
  const trimmed = url.trim();
  if (trimmed.startsWith("data:") || trimmed.startsWith("blob:")) return trimmed;
  return fixBrokenImageUrl(trimmed);
}

/** Blob URLs expire after reload — they cannot be shown from localStorage */
export function isPersistableMediaUrl(url: string): boolean {
  return Boolean(url) && !url.startsWith("blob:");
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileNameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segment = pathname.split("/").pop() ?? "image";
    return decodeURIComponent(segment.split("?")[0] ?? segment);
  } catch {
    return url.split("/").pop()?.split("?")[0] ?? "image.jpg";
  }
}

export type MediaSort = "newest" | "oldest" | "name";
export type MediaDateFilter = "all" | "7d" | "30d";

export type MediaUsageFilter = "all" | "used" | "unused";

export interface MediaListFilters {
  search: string;
  type: MediaType | "all";
  date: MediaDateFilter;
  sort: MediaSort;
  folderId: string | "all";
  tag: string;
  usage: MediaUsageFilter;
}

export const defaultMediaFilters: MediaListFilters = {
  search: "",
  type: "all",
  date: "all",
  sort: "newest",
  folderId: "all",
  tag: "all",
  usage: "all",
};

export interface MediaDuplicateGroup {
  key: string;
  reason: "same-url" | "similar-name";
  files: MediaFile[];
}

export function filterMedia(files: MediaFile[], filters: MediaListFilters): MediaFile[] {
  const query = filters.search.trim().toLowerCase();
  const now = Date.now();

  return files
    .filter((file) => {
      if (query) {
        const haystack = `${file.name} ${file.alt ?? ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (filters.type !== "all" && file.type !== filters.type) return false;
      if (filters.folderId !== "all" && file.folderId !== filters.folderId) return false;
      if (filters.tag !== "all" && !(file.tags ?? []).includes(filters.tag)) return false;
      if (filters.usage === "unused" && countMediaUsage(file.url) > 0) return false;
      if (filters.usage === "used" && countMediaUsage(file.url) === 0) return false;
      if (filters.date !== "all") {
        const ageMs = now - new Date(file.createdAt).getTime();
        const maxAge = filters.date === "7d" ? 7 : 30;
        if (ageMs > maxAge * 86400000) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "name") return a.name.localeCompare(b.name);
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return filters.sort === "newest" ? bTime - aTime : aTime - bTime;
    });
}

export function collectMediaTags(files: MediaFile[]): string[] {
  const tags = new Set<string>();
  for (const file of files) {
    for (const tag of file.tags ?? []) {
      if (tag.trim()) tags.add(tag.trim());
    }
  }
  return Array.from(tags).sort((a, b) => a.localeCompare(b));
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function findDuplicateMediaGroups(files: MediaFile[]): MediaDuplicateGroup[] {
  const byUrl = new Map<string, MediaFile[]>();
  const byName = new Map<string, MediaFile[]>();

  for (const file of files) {
    const urlKey = file.url.trim();
    byUrl.set(urlKey, [...(byUrl.get(urlKey) ?? []), file]);

    const nameKey = normalizeName(file.name);
    if (nameKey.length > 3) {
      byName.set(nameKey, [...(byName.get(nameKey) ?? []), file]);
    }
  }

  const groups: MediaDuplicateGroup[] = [];

  for (const [key, group] of byUrl.entries()) {
    if (group.length > 1) {
      groups.push({ key, reason: "same-url", files: group });
    }
  }

  for (const [key, group] of byName.entries()) {
    if (group.length > 1 && !groups.some((g) => g.reason === "same-url" && g.files.length === group.length)) {
      groups.push({ key, reason: "similar-name", files: group });
    }
  }

  return groups.sort((a, b) => b.files.length - a.files.length);
}

export function getUnusedMediaFiles(files: MediaFile[]): MediaFile[] {
  return files.filter((file) => countMediaUsage(file.url) === 0);
}
