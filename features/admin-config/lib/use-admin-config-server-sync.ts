"use client";

import { useEffect } from "react";

import type { AdminConfigKey } from "./admin-config-api";
import { ensureAdminConfigHydrated } from "./admin-config-hydration";

/**
 * Hydrates the admin-only config blobs (admin profile, payment gateway runtime,
 * payment notification prefs, custom code) from the server once on entering the
 * admin, so they are durable and consistent across devices. Every genuine save
 * dual-writes back to the server.
 *
 * `keys` is what THIS member may read (see admin-config-rules) — asking for
 * the rest only collects refusals. The work is in `ensureAdminConfigHydrated`,
 * which is also callable from a form: this effect never re-runs after an
 * in-app login.
 */
export function useAdminConfigServerSync(keys: readonly AdminConfigKey[]): void {
  const wanted = keys.join(",");
  useEffect(() => {
    if (!wanted) return;
    void ensureAdminConfigHydrated(wanted.split(",") as AdminConfigKey[]);
  }, [wanted]);
}
