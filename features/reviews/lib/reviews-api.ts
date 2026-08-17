/**
 * Client-side reviews API. The storefront review form dual-writes new reviews
 * (public, forced to "pending"); the admin dual-writes moderation changes +
 * deletions and hydrates the full list. Best-effort — never throws.
 */
import type { ProductReview, ProductReviewFormData } from "@/types/review";
import { createHydrationGate } from "@/lib/hydration-gate";
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

/**
 * Public: submit a review. Returns the review the SERVER created, or null.
 *
 * The id matters to the caller. The server mints it now — it no longer accepts
 * one from the body, because that endpoint is unauthenticated and the id was
 * reaching an upsert. So the locally-built record and the stored one differ, and
 * anything that follows up on this review (the admin form's status/feature
 * PATCH) has to address the server's id, not the one this browser invented.
 *
 * The server forces status "pending" regardless of what is sent.
 */
export async function submitReviewRequest(
  review: ProductReview
): Promise<ProductReview | null> {
  try {
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(review),
    });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<ProductReview>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
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

/**
 * Public: the approved reviews for one product, from the server.
 *
 * The storefront used to read this list out of the VISITOR's own localStorage,
 * which meant two things at once: a moderator's approvals and takedowns never
 * reached anybody, and a first-time visitor — whose storage is empty — was shown
 * a fabricated set seeded from the product's own rating, signed with invented
 * names. This endpoint already existed and returns exactly what the page needs.
 *
 * Returns null on failure so the caller can leave the previous list alone rather
 * than render "no reviews yet" over a network blip.
 */
export async function fetchApprovedReviews(
  productSlug: string
): Promise<ProductReview[] | null> {
  try {
    const res = await fetch(`/api/reviews?productSlug=${encodeURIComponent(productSlug)}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<ProductReview[]>;
    return json.success ? (json.data ?? []) : null;
  } catch {
    return null;
  }
}

/** Admin: fetch all reviews (401 → null for non-admins). */
export async function fetchReviews(): Promise<ProductReview[] | null> {
  try {
    const res = await fetch("/api/reviews", { headers: { Accept: "application/json" } });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<ProductReview[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Settled by `useReviewsServerSync` once the server's reviews are in the cache.
 *
 * The admin page's figures used to open on `mounted`, which its own effect sets
 * straight after a SYNCHRONOUS localStorage read — so on a fresh browser the
 * cards painted "0 pending · All clear" and the list said "No reviews found"
 * from an empty cache, before the server had been asked at all. That is the
 * defect the gate was added to prevent, opened by the wrong signal.
 */
export const reviewsHydration = createHydrationGate();
