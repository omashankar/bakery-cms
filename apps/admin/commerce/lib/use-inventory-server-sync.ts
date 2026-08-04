"use client";

import { useEffect } from "react";

import {
  fetchStockHistory,
  fetchInventorySettings,
  inventoryHydration,
} from "./inventory-api";
import { persistServerHistory, persistServerSettings } from "./inventory-repository";

/**
 * Hydrates the local inventory cache (stock history + settings) from the server
 * once on entering the admin, so those views reflect the durable server state.
 * The server is the source of truth; every adjustment still dual-writes to it.
 */
export function useInventoryServerSync(): void {
  useEffect(() => {
    void ensureInventoryHydrated();
  }, []);
}

/**
 * Reads the server's copy into the local one, and opens the gate if it worked.
 *
 * Callable rather than mount-only, like the other gates: the effect above runs
 * from the admin layout, and an admin who signs in through the LOGIN FORM loads
 * that layout while anonymous — so the read 401s, and reaching the admin
 * afterwards is a soft navigation that never remounts it.
 *
 * Only the SETTINGS decide the gate. The history is a read-only log that no
 * write replaces, so failing to load it must not hold the settings form shut;
 * failing to load the settings must, because the form would otherwise be
 * sitting on defaults it could then save over the shop's thresholds.
 */
export async function ensureInventoryHydrated(): Promise<boolean> {
  if (inventoryHydration.hasSettled()) return true;

  const [history, settings] = await Promise.all([
    fetchStockHistory(),
    fetchInventorySettings(),
  ]);

  if (history) persistServerHistory(history);
  if (!settings) return false;

  persistServerSettings(settings);
  inventoryHydration.markSettled();
  return true;
}
