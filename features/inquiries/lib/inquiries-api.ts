/**
 * Client-side inquiries API. The storefront contact form dual-writes new
 * inquiries to the server (so the admin, on another device, sees them); the
 * admin dual-writes status/notes changes + deletions and hydrates the full
 * list. Best-effort — never throws, so the localStorage flow keeps working
 * offline/unauthenticated.
 */
import type { Inquiry } from "@/types/inquiry";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function send(path: string, method: string, body?: unknown): Promise<void> {
  try {
    await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // best-effort
  }
}

/** Public: send the fully-built inquiry to the server (verbatim id/timestamps). */
export function createInquiryRequest(inquiry: Inquiry): void {
  void send("/api/inquiries", "POST", inquiry);
}

export function updateInquiryRequest(id: string, patch: Partial<Inquiry>): void {
  void send(`/api/inquiries/${id}`, "PATCH", patch);
}

export function deleteInquiriesRequest(ids: string[]): void {
  void send("/api/inquiries", "DELETE", { ids });
}

/** Admin: fetch all inquiries from the server (401 → null for non-admins). */
export async function fetchInquiries(): Promise<Inquiry[] | null> {
  try {
    const res = await fetch("/api/inquiries", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<Inquiry[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
