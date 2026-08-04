"use client";

import { useEffect } from "react";

import { hydrateSettingsFromServer } from "@/features/settings/lib/settings-repository";

/**
 * Hydrates local settings from the server once on mount, so the rest of the app
 * (business labels, module gating, commerce config) reflects the durable server
 * state instead of a stale per-browser copy.
 *
 * The read itself lives in `hydrateSettingsFromServer` rather than here, because
 * this mount is not the only thing that needs it: an admin who signs in through
 * the login form loads this layout while anonymous, and the soft navigation into
 * the admin never remounts it. Anything that is about to WRITE settings calls
 * the same function through `ensureSettingsHydrated`.
 */
export function SettingsServerSync() {
  useEffect(() => {
    void hydrateSettingsFromServer();
  }, []);

  return null;
}
