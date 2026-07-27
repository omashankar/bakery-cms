"use client";

import { useEffect } from "react";

import { fetchReviews } from "./reviews-api";
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
      if (!cancelled && reviews) persistServerReviews(reviews);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
