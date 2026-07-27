"use client";

import { useEffect } from "react";

import { fetchStockHistory, fetchInventorySettings } from "./inventory-api";
import { persistServerHistory, persistServerSettings } from "./inventory-repository";

/**
 * Hydrates the local inventory cache (stock history + settings) from the server
 * once on entering the admin, so those views reflect the durable server state.
 * The server is the source of truth; every adjustment still dual-writes to it.
 */
export function useInventoryServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const [history, settings] = await Promise.all([
        fetchStockHistory(),
        fetchInventorySettings(),
      ]);
      if (cancelled) return;
      if (history) persistServerHistory(history);
      if (settings) persistServerSettings(settings);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
