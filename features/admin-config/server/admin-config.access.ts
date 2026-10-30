import type { Actor } from "@/lib/server/auth/access";
import type { Permission } from "@/features/team/lib/permissions";

/**
 * Who may read and write each admin-config blob.
 *
 * One route serves four unrelated things, so one permission for the route
 * would be wrong for three of them. `admin-profile` is the OWNER's own profile
 * (name, phone, photo) from before there was a team — a member reading it would
 * see the owner's phone number, and writing it would rename the owner — so it
 * belongs to owners alone.
 */
const ACCESS: Record<string, { read: Permission; write: Permission } | "owner"> = {
  "admin-profile": "owner",
  "payment-gateways": { read: "payments.view", write: "payments.manage" },
  "payment-notif-prefs": { read: "payments.view", write: "payments.manage" },
  "custom-code": { read: "settings.view", write: "settings.manage" },
};

export function mayUseAdminConfig(actor: Actor, key: string, mode: "read" | "write"): boolean {
  if (!Object.hasOwn(ACCESS, key)) return false;
  const rule = ACCESS[key];
  if (rule === "owner") return actor.isOwner;
  return actor.permissions.has(rule[mode]);
}
