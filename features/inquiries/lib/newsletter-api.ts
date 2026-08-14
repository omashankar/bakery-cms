/**
 * Client-side newsletter API. The storefront subscribe form dual-writes new
 * subscribers to the server (public); the admin dual-writes activate/deactivate
 * + deletions and hydrates the full list. Best-effort — never throws.
 */
import type { NewsletterSubscriber } from "@/types/inquiry";
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

/** Public: subscribe (server dedupes + reactivates by email). */
export function subscribeRequest(input: {
  id?: string;
  email: string;
  source?: string;
}): Promise<boolean> {
  return send("/api/newsletter", "POST", input);
}

export function updateSubscriberRequest(
  id: string,
  patch: Partial<NewsletterSubscriber>
): Promise<boolean> {
  return send(`/api/newsletter/${id}`, "PATCH", patch);
}

export function deleteSubscribersRequest(ids: string[]): Promise<boolean> {
  return send("/api/newsletter", "DELETE", { ids });
}

/** Admin: fetch all subscribers (401 → null for non-admins). */
export async function fetchSubscribers(): Promise<NewsletterSubscriber[] | null> {
  try {
    const res = await fetch("/api/newsletter", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<NewsletterSubscriber[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
