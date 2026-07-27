/**
 * A single audit-trail entry as exposed to the admin client. Mirrors the
 * server-side `AuditLogModel` (append-only) minus internal fields. The trail is
 * written by `writeAuditLog` across every meaningful admin/customer action.
 */
export interface AuditLogEntry {
  id: string;
  action: string;
  actorEmail: string;
  target: { type: string; id: string };
  metadata: Record<string, unknown>;
  ip: string;
  userAgent: string;
  status: "success" | "failure";
  createdAt: string;
}
