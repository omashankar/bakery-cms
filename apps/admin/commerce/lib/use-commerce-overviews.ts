"use client";

import { useCallback, useEffect, useState } from "react";

import {
  fetchCommerceOverviews,
  type CommerceOverviewsResponse,
} from "@/features/orders/lib/orders-api";

/**
 * Refund, invoice and payment overview counters, computed server-side over
 * EVERY order — the browser's order cache only holds the most recent slice, so
 * a total derived from it is quietly too small.
 *
 * Returns `null` until the first response lands. Callers are expected to fall
 * back to computing from their local orders in that case, so the cards are never
 * a row of zeros sitting above a populated table — cold start, offline and an
 * expired session all take that path.
 *
 * Deliberately NOT subscribed to the orders-updated event. That fires several
 * times during admin hydration and again on every local write, and each fetch
 * here is a full-collection aggregation. Call `reload()` after a mutation
 * instead, once the server has actually accepted it.
 */
export function useCommerceOverviews(): {
  overviews: CommerceOverviewsResponse | null;
  reload: () => void;
} {
  const [overviews, setOverviews] = useState<CommerceOverviewsResponse | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await fetchCommerceOverviews();
      // Keep the last good figures on failure rather than zeroing the cards.
      if (!cancelled && result) setOverviews(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { overviews, reload };
}
