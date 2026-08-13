"use client";

import { useEffect } from "react";

import { fetchReviews, reviewsHydration } from "./reviews-api";
import { persistServerReviews } from "./reviews-repository";

/**
 * Hydrates the full review list (all moderation states) from the server once on
 * entering the admin, so moderation decisions + replies are durable and shared
 * across devices. The server is the source of truth; every change dual-writes.
 * (Storefront shows approved reviews via the public GET — this hook is admin-only.)
 */
export function useReviewsServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const reviews = await fetchReviews();
      if (cancelled) return;
      if (reviews) persistServerReviews(reviews);
      // Settled either way: a failed read is still an answer, and leaving the
      // page on a skeleton forever is worse than showing what it has.
      reviewsHydration.markSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
