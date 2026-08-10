import { connectDB } from "@/lib/server/db/mongoose";
import { AuditLogModel } from "@/lib/server/db/models/audit-log.model";
import { clientIpFrom } from "@/lib/server/http/client-ip";

/**
 * Append an audit entry. Fire-and-forget friendly: logging must never break the
 * action it records, so failures are swallowed (and logged to the server console).
 */
export interface AuditInput {
  action: string;
  actorId?: string | null;
  actorEmail?: string;
  target?: { type: string; id: string };
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  status?: "success" | "failure";
}

export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    await connectDB();
    await AuditLogModel.create({
      action: input.action,
      actorId: input.actorId ?? null,
      actorEmail: input.actorEmail ?? "",
      target: input.target ?? { type: "", id: "" },
      metadata: input.metadata ?? {},
      ip: input.ip ?? "",
      userAgent: input.userAgent ?? "",
      status: input.status ?? "success",
    });
  } catch (error) {
    console.error("[audit] failed to write log:", error);
  }
}

/**
 * Pull request IP + user-agent from a Request for audit context.
 *
 * The IP goes through `clientIpFrom`, which believes `x-forwarded-for` only on
 * a deployment that says it is behind a trusted proxy and takes the LAST hop
 * when it does. This used to take the FIRST — the entry the caller wrote — and
 * that value is the login throttle's rate-limit key, so the shop's configured
 * "Max login attempts" was three attempts per header value. It is also what the
 * Security Center prints as the address an action came from; a forgeable IP in
 * an audit trail is worse than no IP.
 */
export function requestContext(request: Request): { ip: string; userAgent: string } {
  return {
    ip: clientIpFrom(request.headers),
    userAgent: request.headers.get("user-agent") || "",
  };
}
