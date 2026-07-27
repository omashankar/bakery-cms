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

function humanizeAction(action: string, status: AuditLogEntry["status"]): string {
  const label = action.replace(/[._]/g, " ");
  return status === "failure" ? `${label} (failed)` : label;
}

export function auditToActivity(entry: AuditLogEntry): ActivityLog {
  const segments = entry.action.split(".");
  const entity = segments[0] || "system";
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
