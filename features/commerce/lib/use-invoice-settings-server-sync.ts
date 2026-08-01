"use client";

import { useEffect } from "react";

import { fetchInvoiceSettings, invoiceSettingsHydration } from "./invoice-settings-api";
import { persistServerInvoiceSettings } from "./invoice-settings-repository";

/**
 * Hydrates invoice settings from the server on entering the admin, so the
 * invoice template reflects the durable server state. Every save dual-writes.
 *
 * Opening the gate is the point: until this read SUCCEEDS, a save would push
 * whatever this browser happens to hold — and `loadInvoiceSettings()` seeds
 * demo constants when localStorage is empty, so that is a demo company and a
 * demo address replacing the shop's real ones.
 */
export function useInvoiceSettingsServerSync(): void {
  useEffect(() => {
    void ensureInvoiceSettingsHydrated();
  }, []);
}

/**
 * Reads the server's copy into the local one, and opens the gate if it worked.
 *
 * Callable on demand rather than only from a mount effect. The sync above runs
 * from a `[]`-dep effect in the admin layout — and an admin who signs in
 * through the LOGIN FORM loads that layout while anonymous, so the fetch 401s
 * and the gate stays shut; reaching the admin afterwards is a `router.push`, a
 * soft navigation that never remounts the layout. The effect never runs again.
 * Without an on-demand opener the gate would stay shut for the whole session
 * and every invoice-design save would report "saved on this device only" — the
 * exact failure the settings gate was given `ensureSettingsHydrated` for.
 */
export async function ensureInvoiceSettingsHydrated(): Promise<boolean> {
  if (invoiceSettingsHydration.hasSettled()) return true;

  const settings = await fetchInvoiceSettings();
  // ONLY on a successful read. A null is a failure — an expired token, a cold
  // start, a dropped connection — and settling on it would defeat the gate.
  if (!settings) return false;

  persistServerInvoiceSettings(settings);
  invoiceSettingsHydration.markSettled();
  return true;
}
