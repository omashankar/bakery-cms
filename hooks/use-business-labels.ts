"use client";

import { useEffect, useState } from "react";
import {
  getBusinessLabels,
  resolveLabels,
  type BusinessLabels,
} from "@/config/business-labels";
import {
  getLabelSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";

/**
 * The shop's own product wording for client UI.
 *
 * Starts at the neutral defaults so SSR and the first client paint agree, then
 * layers the shop's own overrides after mount and re-reads whenever settings
 * change.
 *
 * Changes visible wording only (e.g. "Products" → "Flowers"). Routes, folders,
 * components and database collections are never renamed from here.
 */
export function useBusinessLabels(): BusinessLabels {
  const [labels, setLabels] = useState<BusinessLabels>(getBusinessLabels);

  useEffect(() => {
    /**
     * The shop's OWN words, over the neutral defaults.
     *
     * This resolved from `businessType` alone and threw away the overrides the
     * server had already layered on — so `labelOverrides` was inert, and a shop
     * that wanted "Bouquet" got "Cake" whatever it typed. Wiring it had to come
     * BEFORE the enum was deleted, or the sidebar and products list would have
     * quietly reverted to "Cakes" with nothing able to override them.
     *
     * `resolveLabels` is the single place a blank means "use the default".
     */
    const sync = () => {
      setLabels({ ...getBusinessLabels(), ...resolveLabels(getLabelSettings()) });
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  return labels;
}
