import type { MediaFolder } from "@/types/media";

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
    if (!Array.isArray(parsed) || parsed.length === 0) {
      persist(defaultMediaFolders);
      return defaultMediaFolders;
    }
    return parsed;
  } catch {
    persist(defaultMediaFolders);
    return defaultMediaFolders;
  }
}

export function saveMediaFolders(folders: MediaFolder[]): MediaFolder[] {
  persist(folders);
  return folders;
}

export function createMediaFolder(name: string): MediaFolder {
  const folders = loadMediaFolders();
  const folder: MediaFolder = {
    id: `folder-${Date.now()}`,
    name: name.trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  saveMediaFolders([...folders, folder]);
  return folder;
}

export function deleteMediaFolder(id: string): boolean {
  if (defaultMediaFolders.some((folder) => folder.id === id)) return false;
  const folders = loadMediaFolders().filter((folder) => folder.id !== id);
  saveMediaFolders(folders);
  return true;
}

export function getMediaFolderById(id: string): MediaFolder | undefined {
  return loadMediaFolders().find((folder) => folder.id === id);
}
