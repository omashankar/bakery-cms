/**
 * Client-side reviews API. The storefront review form dual-writes new reviews
 * (public, forced to "pending"); the admin dual-writes moderation changes +
 * deletions and hydrates the full list. Best-effort — never throws.
 */
import type { ProductReview, ProductReviewFormData } from "@/types/review";

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
    return res.ok;
  } catch {
    return false;
  }
}

/** Public: submit a review (the server forces status "pending"). */
export function submitReviewRequest(review: ProductReview): Promise<boolean> {
  return send("/api/reviews", "POST", review);
}

export function updateReviewRequest(
  id: string,
  patch: Partial<ProductReviewFormData>
): Promise<boolean> {
  return send(`/api/reviews/${id}`, "PATCH", patch);
}

export function deleteReviewsRequest(ids: string[]): Promise<boolean> {
  return send("/api/reviews", "DELETE", { ids });
}

/** Admin: fetch all reviews (401 → null for non-admins). */
export async function fetchReviews(): Promise<ProductReview[] | null> {
  try {
    const res = await fetch("/api/reviews", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<ProductReview[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
