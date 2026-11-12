import "server-only";

import { getCurrentUser } from "@/lib/server/auth/dal";
import type { Actor } from "@/lib/server/auth/access";

import { getAdminConfig } from "./admin-config.service";
import { mayUseAdminConfig } from "./admin-config.access";

/**
 * The admin-config blobs THIS person may read — each one they may not is null,
 * exactly as if the browser's own read had been refused. This lands in the
 * page's HTML, so it applies the same rule as GET /api/admin-config/[key].
 */
export async function readAdminConfigForAdmin(actor: Actor) {
  const read = (key: string) =>
    mayUseAdminConfig(actor, key, "read") ? getAdminConfig(key) : Promise.resolve(null);
  const [profile, gateways, prefs, code, account] = await Promise.all([
    read("admin-profile"),
    read("payment-gateways"),
    read("payment-notif-prefs"),
    read("custom-code"),
    getCurrentUser(),
  ]);
  return { profile, gateways, prefs, code, account };
}
