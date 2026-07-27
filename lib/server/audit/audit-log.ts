import { connectDB } from "@/lib/server/db/mongoose";
import { AuditLogModel } from "@/lib/server/db/models/audit-log.model";

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

/** Pull request IP + user-agent from a Request for audit context. */
export function requestContext(request: Request): { ip: string; userAgent: string } {
  const headers = request.headers;
  const ip =
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "";
  return { ip, userAgent: headers.get("user-agent") || "" };
}
