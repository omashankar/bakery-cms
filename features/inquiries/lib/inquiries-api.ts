/**
 * Client-side inquiries API. The storefront contact form dual-writes new
 * inquiries to the server (so the admin, on another device, sees them); the
 * admin dual-writes status/notes changes + deletions and hydrates the full
 * list. Best-effort — never throws, so the localStorage flow keeps working
 * offline/unauthenticated.
 */
import type { Inquiry } from "@/types/inquiry";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/**
 * Whether the SERVER accepted the write. Resolves false on a network failure OR
 * a non-2xx response; never throws.
 *
 * The `res.ok` check is the point. Without it a 401 from an expired admin token
 * and a 500 both read as success, and the caller goes on to report a change that
 * the next hydration silently reverts.
 */
async function send(path: string, method: string, body?: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    noteAuthStatus(res.status);
    return res.ok;
  } catch {
    return false;
  }
}

/** Public: send the fully-built inquiry to the server (verbatim id/timestamps). */
/**
 * Public: submit an enquiry. Returns the record the SERVER created, or null.
 *
 * The id matters to the caller. The server mints it now — it no longer accepts
 * one from the body, because that endpoint is unauthenticated and the id was
 * reaching an upsert on guessable keys. So the locally-built record and the
 * stored one differ, and anything that follows up on this enquiry has to address
 * the server's id.
 *
 * The server also forces `status: "new"` regardless of what is sent.
 */
export async function createInquiryRequest(inquiry: Inquiry): Promise<Inquiry | null> {
  try {
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiry),
    });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as { success: boolean; data: Inquiry | null };
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export function updateInquiryRequest(id: string, patch: Partial<Inquiry>): Promise<boolean> {
  return send(`/api/inquiries/${id}`, "PATCH", patch);
}

export function deleteInquiriesRequest(ids: string[]): Promise<boolean> {
  return send("/api/inquiries", "DELETE", { ids });
}

/** Admin: fetch all inquiries from the server (401 → null for non-admins). */
export async function fetchInquiries(): Promise<Inquiry[] | null> {
  try {
    const res = await fetch("/api/inquiries", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<Inquiry[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
