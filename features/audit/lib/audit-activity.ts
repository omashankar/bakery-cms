import type { AuditLogEntry } from "@/types/audit";
import type { ActivityLog } from "@/types/settings";

/**
 * Maps the server audit trail onto the existing `ActivityLog` shape the Activity
 * Log page already renders, so the durable cross-device trail shows up in the
 * same list without any UI change. The action verb is coarsened to the small set
 * the page's tone badges recognise (unknown verbs fall back to "updated").
 */
const VERB_TONE: Record<string, string> = {
  create: "created",
  place: "created",
  register: "created",
  signup: "created",
  update: "updated",
  status: "updated",
  payment: "updated",
  notes: "updated",
  replace: "updated",
  refund: "updated",
  save: "updated",
  reset: "updated",
  login: "received",
  logout: "received",
  delete: "cleared",
  clear: "cleared",
  cancel: "disabled",
  disable: "disabled",
  enable: "enabled",
};

/**
 * What each action says in the log, in words a shop owner uses.
 *
 * The log printed the action's id with the dots taken out — "team invite
 * link", "auth login", "delivery zones replace" — which reads as a machine
 * talking to itself. Anything not named here still gets a sentence from its
 * parts (see `fromParts`).
 */
const PHRASES: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.logout": "Signed out",
  "auth.change_password": "Changed their password",
  "auth.forgot_password": "Asked for a password reset",
  "auth.reset_password": "Reset their password",
  "security.logout_all": "Signed out on every device",
  "security.session.revoke": "Ended a signed-in session",
  "team.invite": "Invited a team member",
  "team.invite.accept": "Joined the team",
  "team.invite.link": "Made a new invitation link",
  "team.invite.resend": "Sent an invitation again",
  "team.invite.revoke": "Revoked an invitation",
  "team.member.remove": "Removed a team member",
  "team.member.role": "Changed a member's role",
  "team.member.status": "Changed a member's status",
  "team.role.create": "Created a role",
  "team.role.update": "Edited a role",
  "team.role.delete": "Deleted a role",
  "order.place": "Order placed",
  "order.status": "Order status changed",
  "order.cancel": "Order cancelled",
  "order.paid": "Order paid",
  "order.payment": "Payment status changed",
  "order.notes": "Order notes edited",
  "order.delivery_partner": "Delivery partner set",
  "order.refund": "Refund issued",
  "order.refund.request": "Refund requested",
  "order.refund.decline": "Refund declined",
  "order.refund.notes": "Refund notes edited",
  "payment.captured": "Payment received",
  "payment.unclaimed.refunded": "Stray payment marked refunded",
  "product.create": "Product added",
  "product.update": "Product edited",
  "product.delete": "Product deleted",
  "inventory.adjust": "Stock adjusted",
  "inventory.set_unlimited": "Stock set to unlimited",
  "inventory.settings.update": "Stock settings changed",
  "customer.sign_in": "Customer signed in",
  "customer.sign_in.request": "Customer asked for a sign-in code",
  "customer.sign_in.failed": "Customer sign-in failed",
  "customer.meta.update": "Customer notes edited",
  "inquiry.create": "New inquiry received",
  "inquiry.update": "Inquiry updated",
  "inquiry.delete": "Inquiry deleted",
  "newsletter.subscribe": "Newsletter sign-up",
  "newsletter.update": "Newsletter subscriber updated",
  "newsletter.delete": "Newsletter subscriber removed",
  "review.submit": "Review submitted",
  "review.update": "Review updated",
  "review.delete": "Review deleted",
  "media.files.add": "Media uploaded",
  "media.files.replace": "Media library updated",
  "media.folders.replace": "Media folders updated",
  "delivery_zones.replace": "Delivery zones updated",
  "coupons.replace": "Coupons updated",
  "payments.invoice_settings.update": "Invoice settings changed",
  "communications.whatsapp.connection.update": "WhatsApp connection changed",
  "communications.whatsapp.sync": "WhatsApp templates synced",
};

const PAST: Record<string, string> = {
  create: "created",
  update: "updated",
  replace: "updated",
  save: "saved",
  delete: "deleted",
  remove: "removed",
  reset: "reset",
  publish: "published",
  revoke: "revoked",
  enable: "turned on",
  disable: "turned off",
};

/** "settings.general.update" → "Settings general updated". */
function fromParts(action: string): string {
  const parts = action.split(".").map((part) => part.replace(/_/g, " "));
  const last = action.split(".").at(-1) ?? "";
  if (parts.length > 1 && PAST[last]) parts[parts.length - 1] = PAST[last];
  const text = parts.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function humanizeAction(action: string, status: AuditLogEntry["status"]): string {
  const label = PHRASES[action] ?? fromParts(action);
  return status === "failure" ? `${label} (failed)` : label;
}

export function auditToActivity(entry: AuditLogEntry): ActivityLog {
  const segments = entry.action.split(".");
  // "delivery_zones" reads as "delivery zones" wherever the entity is shown.
  const entity = (segments[0] || "system").replace(/_/g, " ");
  const verb = segments[segments.length - 1] || "";

  return {
    id: entry.id,
    action: VERB_TONE[verb] ?? "updated",
    entity,
    entityId: entry.target?.id || undefined,
    details: humanizeAction(entry.action, entry.status),
    timestamp: entry.createdAt,
    userId: entry.actorEmail || "system",
  };
}

/** Merge server + local activity, dedupe by id, newest first. */
export function mergeActivity(server: ActivityLog[], local: ActivityLog[]): ActivityLog[] {
  const seen = new Set<string>();
  const merged: ActivityLog[] = [];
  for (const entry of [...server, ...local]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  return merged.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
