"use client";

import { useEffect } from "react";
import { hydrateOnce } from "@/lib/hydrate-once";

import { fetchOrders } from "./orders-api";
import { markOrdersSyncSettled, persistServerOrders } from "./orders";

/**
 * Hydrates the local order cache from the server once on entering the admin, so
 * the admin sees every order (including those placed on other devices). The
 * server is the source of truth; every placement/change still dual-writes to it.
 */
export function useOrdersServerSync(): void {
  useEffect(() => {
    // Keyed, not cancelled: the dashboard and the notifications screen both
    // mount this for themselves rather than waiting out the layout's deferral,
    // and the later caller joins this read instead of issuing another.
    void hydrateOnce("orders", async () => {
      const orders = await fetchOrders();
      if (orders) persistServerOrders(orders);
      // Mark settled even when the fetch failed, so screens stop waiting and
      // fall back to the cache rather than showing a spinner forever.
      markOrdersSyncSettled();
    });
  }, []);
}
