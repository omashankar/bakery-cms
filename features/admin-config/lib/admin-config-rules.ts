import type { Permission } from "@/features/team/lib/permissions";

/**
 * Who may read and write each admin-config blob — one table, read by the API
 * (which enforces it) and by the admin shell (which uses it to skip asking for
 * what the member would be refused).
 *
 * One route serves four unrelated things, so one permission for the route
 * would be wrong for three of them. `admin-profile` is the OWNER's own profile
 * (name, phone, photo) from before there was a team — a member reading it would
 * see the owner's phone number, and writing it would rename the owner — so it
 * belongs to owners alone.
 */
export const ADMIN_CONFIG_ACCESS: Record<string, { read: Permission; write: Permission } | "owner"> = {
  "admin-profile": "owner",
  "payment-gateways": { read: "payments.view", write: "payments.manage" },
  "payment-notif-prefs": { read: "payments.view", write: "payments.manage" },
  "custom-code": { read: "settings.view", write: "settings.manage" },
};

export function mayUseAdminConfigBlob(
  member: { isOwner: boolean; has: (permission: Permission) => boolean },
  key: string,
  mode: "read" | "write",
): boolean {
  if (!Object.hasOwn(ADMIN_CONFIG_ACCESS, key)) return false;
  const rule = ADMIN_CONFIG_ACCESS[key];
  if (rule === "owner") return member.isOwner;
  return member.isOwner || member.has(rule[mode]);
}
