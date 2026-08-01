"use client";

import { useEffect } from "react";

import { ensureAdminConfigHydrated } from "./admin-config-hydration";

/**
 * Hydrates the admin-only config blobs (admin profile, payment gateway runtime,
 * payment notification prefs, custom code) from the server once on entering the
 * admin, so they are durable and consistent across devices. Every genuine save
 * dual-writes back to the server. These endpoints are admin-guarded.
 *
 * The work is in `ensureAdminConfigHydrated`, which is also callable from a
 * form: this effect never re-runs after an in-app login, and it opened the gate
 * when ANY ONE of the four blobs loaded — vouching for three it had not read.
 */
export function useAdminConfigServerSync(): void {
  useEffect(() => {
    void ensureAdminConfigHydrated();
  }, []);
}
