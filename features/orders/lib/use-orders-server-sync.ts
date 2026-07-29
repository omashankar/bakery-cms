"use client";

import { useEffect } from "react";

import { fetchOrders } from "./orders-api";
import { markOrdersSyncSettled, persistServerOrders } from "./orders";

/**
 * Hydrates the local order cache from the server once on entering the admin, so
 * the admin sees every order (including those placed on other devices). The
 * server is the source of truth; every placement/change still dual-writes to it.
 */
export function useOrdersServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const orders = await fetchOrders();
      if (cancelled) return;
      if (orders) persistServerOrders(orders);
      // Mark settled even when the fetch failed, so screens stop waiting and
      // fall back to the cache rather than showing a spinner forever.
      markOrdersSyncSettled();
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
