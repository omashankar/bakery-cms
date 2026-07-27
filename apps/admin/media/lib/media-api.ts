/**
 * Client-side media API. Files + folders replace-all dual-write + hydrate;
 * uploads go through Cloudinary (server-side). Best-effort — never throws.
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

function putJson(path: string, body: unknown): void {
  void (async () => {
    try {
      await fetch(path, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // best-effort
    }
  })();
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
