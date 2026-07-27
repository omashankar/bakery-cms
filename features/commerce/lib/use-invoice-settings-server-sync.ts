"use client";

import { useEffect } from "react";

import { fetchInvoiceSettings } from "./invoice-settings-api";
import { persistServerInvoiceSettings } from "./invoice-settings-repository";

/**
 * Hydrates invoice settings from the server once on entering the admin, so the
 * invoice template reflects the durable server state. Every save dual-writes.
 */
export function useInvoiceSettingsServerSync(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const settings = await fetchInvoiceSettings();
      if (!cancelled && settings) persistServerInvoiceSettings(settings);
    })();

    return () => {
      cancelled = true;
    };
  }, []);
}
