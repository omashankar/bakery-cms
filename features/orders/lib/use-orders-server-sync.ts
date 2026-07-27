"use client";

import { useEffect } from "react";

import { fetchOrders } from "./orders-api";
import { persistServerOrders } from "./orders";

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
      if (!cancelled && orders) persistServerOrders(orders);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
