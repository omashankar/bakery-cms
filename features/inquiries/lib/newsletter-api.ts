/**
 * Client-side newsletter API. The storefront subscribe form dual-writes new
 * subscribers to the server (public); the admin dual-writes activate/deactivate
 * + deletions and hydrates the full list. Best-effort — never throws.
 */
import type { NewsletterSubscriber } from "@/types/inquiry";

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

/** Public: subscribe (server dedupes + reactivates by email). */
export function subscribeRequest(input: {
  id?: string;
  email: string;
  source?: string;
}): void {
  void send("/api/newsletter", "POST", input);
}

export function updateSubscriberRequest(id: string, patch: Partial<NewsletterSubscriber>): void {
  void send(`/api/newsletter/${id}`, "PATCH", patch);
}

export function deleteSubscribersRequest(ids: string[]): void {
  void send("/api/newsletter", "DELETE", { ids });
}

/** Admin: fetch all subscribers (401 → null for non-admins). */
export async function fetchSubscribers(): Promise<NewsletterSubscriber[] | null> {
  try {
    const res = await fetch("/api/newsletter", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<NewsletterSubscriber[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
