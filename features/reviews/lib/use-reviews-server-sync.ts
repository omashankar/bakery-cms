"use client";

import { useEffect } from "react";

import { hydrateOnce } from "@/lib/hydrate-once";
import { fetchReviews, reviewsHydration } from "./reviews-api";
import { persistServerReviews } from "./reviews-repository";

/**
 * Hydrates the full review list (all moderation states) from the server once on
 * entering the admin, so moderation decisions + replies are durable and shared
 * across devices. The server is the source of truth; every change dual-writes.
 * (Storefront shows approved reviews via the public GET — this hook is admin-only.)
 *
 * Safe to mount TWICE, which is what lets the Reviews page call it for itself
 * rather than waiting for the admin layout's deferred batch. That batch is held
 * behind `useIdle(1000)` so the screen the admin opened gets the connection
 * first — sound for every screen except the ones, like Reviews, whose own
 * content IS one of these caches. Measured in a production build: the review
 * list appeared at 2508ms, and `/api/reviews` did not answer until 1565ms
 * because it was waiting out a delay meant to help it.
 *
 * `hydrateOnce` is what makes the second mount free: the layout's later call
 * joins this read instead of issuing another.
 */
export function useReviewsServerSync(): void {
  useEffect(() => {
    void hydrateOnce("reviews", async () => {
      const reviews = await fetchReviews();
      if (reviews) persistServerReviews(reviews);
      // Settled either way: a failed read is still an answer, and leaving the
      // page on a skeleton forever is worse than showing what it has.
      reviewsHydration.markSettled();
    });
  }, []);
}
