import "server-only";

import { getCurrentUser } from "@/lib/server/auth/dal";

import { getAdminConfig } from "./admin-config.service";

/**
 * The five reads `ensureAdminConfigHydrated` makes, as the GETs answer this
 * admin: the four config blobs and `/api/auth/me`. The gate opens on all four
 * blobs, so a screen that waits on it needs every one.
 *
 * Only for the screens that edit these — the payment blob carries gateway
 * settings, and it has no business in every admin page's HTML.
 */
export async function readAdminConfigForAdmin() {
  const [profile, gateways, prefs, code, account] = await Promise.all([
    getAdminConfig("admin-profile"),
    getAdminConfig("payment-gateways"),
    getAdminConfig("payment-notif-prefs"),
    getAdminConfig("custom-code"),
    getCurrentUser(),
  ]);
  return { profile, gateways, prefs, code, account };
}
