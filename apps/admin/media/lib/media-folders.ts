import type { MediaFolder } from "@/types/media";
import { replaceMediaFoldersRequest } from "./media-api";
import type { WriteResult } from "@/lib/write-result";

const FOLDERS_STORAGE_KEY = "bakery-cms-media-folders";

export const UPLOADS_FOLDER_ID = "folder-uploads";
export const CAKES_FOLDER_ID = "folder-cakes";
export const BANNERS_FOLDER_ID = "folder-banners";
export const GALLERY_FOLDER_ID = "folder-gallery";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultMediaFolders: MediaFolder[] = [
  {
    id: CAKES_FOLDER_ID,
    name: "Cakes",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: BANNERS_FOLDER_ID,
    name: "Banners & Offers",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: GALLERY_FOLDER_ID,
    name: "Gallery",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  {
    id: UPLOADS_FOLDER_ID,
    name: "Uploads",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

function persist(folders: MediaFolder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
}

export function loadMediaFolders(): MediaFolder[] {
  if (typeof window === "undefined") return defaultMediaFolders;

  const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
  if (!raw) {
    persist(defaultMediaFolders);
    return defaultMediaFolders;
  }

  try {
    const parsed = JSON.parse(raw) as MediaFolder[];
    // Only a missing or unreadable value seeds — see the other content caches.
    if (!Array.isArray(parsed)) {
      persist(defaultMediaFolders);
      return defaultMediaFolders;
    }
    return parsed;
  } catch {
    persist(defaultMediaFolders);
    return defaultMediaFolders;
  }
}

export async function saveMediaFolders(
  folders: MediaFolder[]
): Promise<WriteResult<MediaFolder[]>> {
  persist(folders);
  return { value: folders, persisted: await replaceMediaFoldersRequest(folders) };
}

/** Hydration: write the server's folders into the local cache (no re-push). */
export function persistServerMediaFolders(folders: MediaFolder[]): void {
  persist(folders);
}

/** Trimmed and case-folded, so "cakes" and "Cakes " are the same folder name. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function mediaFolderNameTaken(name: string): boolean {
  return loadMediaFolders().some((folder) => sameName(folder.name, name));
}

/**
 * `value` is null when the name is already taken.
 *
 * There was no check at all, and the sidebar and the Move dialog show only the
 * name — the option's value is the id. So a second folder called "Cakes" was
 * visually identical to the built-in one, and files scattered across two folders
 * the admin believed were one, with no way to tell them apart or to merge them.
 */
export async function createMediaFolder(
  name: string,
): Promise<WriteResult<MediaFolder | null>> {
  const trimmed = name.trim();
  if (!trimmed) return { value: null, persisted: false };
  if (mediaFolderNameTaken(trimmed)) return { value: null, persisted: false };

  const folders = loadMediaFolders();
  const folder: MediaFolder = {
    id: `folder-${Date.now()}`,
    name: trimmed,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  const { persisted } = await saveMediaFolders([...folders, folder]);
  return { value: folder, persisted };
}

/** `value` is false for a built-in folder, which cannot be deleted at all. */
export async function deleteMediaFolder(id: string): Promise<WriteResult<boolean>> {
  if (defaultMediaFolders.some((folder) => folder.id === id)) {
    return { value: false, persisted: false };
  }
  const folders = loadMediaFolders().filter((folder) => folder.id !== id);
  const { persisted } = await saveMediaFolders(folders);
  return { value: true, persisted };
}

export function getMediaFolderById(id: string): MediaFolder | undefined {
  return loadMediaFolders().find((folder) => folder.id === id);
}
