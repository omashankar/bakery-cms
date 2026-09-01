"use client";

import { useEffect, useState } from "react";
import {
  getBusinessLabels,
  resolveLabels,
  type BusinessLabels,
} from "@/config/business-labels";
import {
  getGeneralSettings,
  getLabelSettings,
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
    /**
     * The shop's OWN words first, then the business-type preset.
     *
     * This resolved from `businessType` alone and threw away the overrides the
     * server had already layered on — so `labelOverrides` was inert, and a shop
     * that wanted "Bouquet" got "Cake" whatever it typed. It also made the
     * wording depend entirely on a closed ten-value enum, which is why deleting
     * that enum could not be done before this: `getBusinessLabels` falls back
     * to the bakery labels, so the sidebar and the products list would have
     * quietly gone back to "Cakes" with nothing able to override them.
     *
     * `resolveLabels` is the single place a blank means "use the preset".
     */
    const sync = () => {
      const preset = getBusinessLabels(getGeneralSettings().businessType);
      const resolved = resolveLabels(getGeneralSettings().businessType, getLabelSettings());
      setLabels({ ...preset, ...resolved });
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  return labels;
}
