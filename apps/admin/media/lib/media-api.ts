/**
 * Client-side media API. Files + folders replace-all dual-write + hydrate;
 * uploads go through Cloudinary (server-side). Never throws; every write reports whether the server took it.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type { MediaFile, MediaFolder } from "@/types/media";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
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
    noteAuthStatus(res.status);
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
 * "This shop has no image host" and "the upload was rejected" are DIFFERENT
 * answers, and this used to return `null` for both.
 *
 * The caller's fallback for an unconfigured shop is to store the image inline as
 * base64. Giving it the same answer for a rotated API key, an exhausted free
 * tier, a timeout or a 500 meant a configured shop silently began writing
 * megabytes of base64 into localStorage, into the whole-library Mongo document
 * and into its own product records — under a green success toast — while being
 * told to "add Cloudinary credentials" it already had.
 *
 * The server distinguishes them on the wire: it answers 200 with
 * `configured: false` when there is no host, and anything else is a failure.
 */
export type UploadOutcome =
  | { status: "uploaded"; asset: UploadedAsset }
  | { status: "unconfigured" }
  | { status: "failed"; reason: UploadFailure };

/**
 * WHY it failed. One "your image host refused it — check the account" used to
 * cover all of these, so a router that had not resolved api.cloudinary.com
 * sent the owner to inspect a Cloudinary account that was fine.
 *
 * The server says which on the status code — see `uploadError` in
 * lib/server/media/cloudinary.ts.
 */
export type UploadFailure =
  /** This browser never reached the shop's own server. */
  | "offline"
  /** The shop's server could not reach the image host. */
  | "unreachable"
  /** The admin session ended, or this account may not upload. */
  | "signed-out"
  | "forbidden"
  /** The request body was too big for the server to read. */
  | "too-large"
  /** The image host answered and said no, or the server failed. */
  | "refused";

function failureFor(status: number): UploadFailure {
  if (status === 401) return "signed-out";
  if (status === 403) return "forbidden";
  if (status === 413) return "too-large";
  if (status === 504) return "unreachable";
  return "refused";
}

/** What each failure tells the admin to DO — the one copy every upload toast reads. */
export function uploadFailureMessage(reason: UploadFailure): string {
  switch (reason) {
    case "offline":
      return "Could not reach the shop. Check your internet connection, then try again.";
    case "unreachable":
      return "Could not reach the image host. Check your internet connection, then try again in a moment.";
    case "signed-out":
      return "Your session has ended. Sign in again, then retry.";
    case "forbidden":
      return "Your account is not allowed to upload images.";
    case "too-large":
      return "That picture is too large to send. Try a smaller one.";
    case "refused":
      return "Your image host did not accept it. Check the image host account, then try again.";
  }
}

/** Upload an image (data URI, or an https URL for Cloudinary to fetch). */
export async function uploadMediaRequest(
  source: string,
  folder?: string,
): Promise<UploadOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, folder }),
    });
  } catch {
    return { status: "failed", reason: "offline" };
  }
  if (!res.ok) {
    noteAuthStatus(res.status);
    return { status: "failed", reason: failureFor(res.status) };
  }
  try {
    const json = (await res.json()) as Envelope<UploadedAsset & { configured: boolean }>;
    if (!json.success) return { status: "failed", reason: "refused" };
    if (!json.data?.configured) return { status: "unconfigured" };
    return { status: "uploaded", asset: json.data };
  } catch {
    return { status: "failed", reason: "refused" };
  }
}
