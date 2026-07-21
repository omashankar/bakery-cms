"use client";

import { useEffect, useState } from "react";
import { getBusinessLabels, type BusinessLabels } from "@/config/business-labels";
import {
  getGeneralSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";

/**
 * Business-type product labels for client UI. Defaults to the bakery labels so
 * SSR / the bakery template render exactly as before, then resolves the real
 * business type on the client and re-reads whenever settings change.
 *
 * Used to make visible wording (e.g. "Cakes" → "Flowers") business-aware WITHOUT
 * renaming any route, folder, component, or database collection.
 */
export function useBusinessLabels(): BusinessLabels {
  const [labels, setLabels] = useState<BusinessLabels>(() => getBusinessLabels("bakery"));

  useEffect(() => {
    const sync = () => setLabels(getBusinessLabels(getGeneralSettings().businessType));
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  return labels;
}
