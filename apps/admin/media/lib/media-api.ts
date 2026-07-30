/**
 * Client-side media API. Files + folders replace-all dual-write + hydrate;
 * uploads go through Cloudinary (server-side). Never throws; every write reports whether the server took it.
 */
import type { MediaFile, MediaFolder } from "@/types/media";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Whether the SERVER accepted the write. Resolves false on a network failure OR
 * a non-2xx response; never throws.
 *
 * This used to be fire-and-forget — it launched the request into a floating
 * async IIFE and returned void, so a 401 from an expired admin token and a 500
 * were both indistinguishable from success. Every caller then reported "saved"
 * for a change that lives only in this browser and that the next hydration
 * silently reverts.
 */
async function putJson(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const fetchMediaFiles = () => getJson<MediaFile[]>("/api/media");
export const replaceMediaFilesRequest = (files: MediaFile[]) => putJson("/api/media", files);

export const fetchMediaFolders = () => getJson<MediaFolder[]>("/api/media/folders");
export const replaceMediaFoldersRequest = (folders: MediaFolder[]) =>
  putJson("/api/media/folders", folders);

export interface UploadedAsset {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  bytes?: number;
  format?: string;
}

/**
 * Upload an image (data URI) to Cloudinary via the server. Returns the uploaded
 * asset, or null when Cloudinary is not configured / the upload fails — callers
 * then fall back to storing the raw source (the pre-Cloudinary behaviour).
 */
export async function uploadMediaRequest(
  source: string,
  folder?: string,
): Promise<UploadedAsset | null> {
  try {
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, folder }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<UploadedAsset & { configured: boolean }>;
    if (!json.success || !json.data?.configured) return null;
    return json.data;
  } catch {
    return null;
  }
}
