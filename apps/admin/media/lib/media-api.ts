/**
 * Client-side media API. Files + folders replace-all dual-write + hydrate;
 * uploads go through Cloudinary (server-side). Never throws; every write reports whether the server took it.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
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

/** Settled by this module's `*ServerSync` once the server's copy is loaded. */
export const mediaHydration = createHydrationGate();

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 */
async function guardedPut(path: string, body: unknown): Promise<boolean> {
  if (!(await mediaHydration.waitForSettled())) return false;
  return putJson(path, body);
}

export const fetchMediaFiles = () => getJson<MediaFile[]>("/api/media");
/**
 * Save the library, naming any ids being DELETED.
 *
 * Only named ids have their Cloudinary asset destroyed. A rename, a folder
 * move or an alt-text edit sends no ids and destroys nothing — a replace-all
 * used to mean "delete everything absent from this list", which a stale tab
 * turned into the permanent loss of another admin's uploads.
 */
export const replaceMediaFilesRequest = (files: MediaFile[], deletedIds: string[] = []) =>
  guardedPut("/api/media", { files, deletedIds });

export const fetchMediaFolders = () => getJson<MediaFolder[]>("/api/media/folders");
export const replaceMediaFoldersRequest = (folders: MediaFolder[]) =>
  guardedPut("/api/media/folders", folders);

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
