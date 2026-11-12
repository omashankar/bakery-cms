import type { Actor } from "@/lib/server/auth/access";
import { mayUseAdminConfigBlob } from "@/features/admin-config/lib/admin-config-rules";

/** Who may read and write each admin-config blob — the table is in admin-config-rules. */
export function mayUseAdminConfig(actor: Actor, key: string, mode: "read" | "write"): boolean {
  return mayUseAdminConfigBlob(
    { isOwner: actor.isOwner, has: (permission) => actor.permissions.has(permission) },
    key,
    mode,
  );
}
