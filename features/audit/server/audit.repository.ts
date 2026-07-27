import { connectDB } from "@/lib/server/db/mongoose";
import { AuditLogModel } from "@/lib/server/db/models/audit-log.model";
import type { AuditLogEntry } from "@/types/audit";

/** Audit repository — read-only access to the append-only audit trail. */

export interface AuditListQuery {
  action?: string;
  actorEmail?: string;
  targetType?: string;
  status?: "success" | "failure";
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

interface RawAudit {
  _id: unknown;
  action: string;
  actorEmail?: string;
  target?: { type?: string; id?: string };
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  status?: string;
  createdAt?: Date | string;
}

function toEntry(raw: RawAudit): AuditLogEntry {
  return {
    id: String(raw._id),
    action: raw.action,
    actorEmail: raw.actorEmail ?? "",
    target: { type: raw.target?.type ?? "", id: raw.target?.id ?? "" },
    metadata: raw.metadata ?? {},
    ip: raw.ip ?? "",
    userAgent: raw.userAgent ?? "",
    status: raw.status === "failure" ? "failure" : "success",
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : "",
  };
}

export async function list(q: AuditListQuery): Promise<{ items: AuditLogEntry[]; total: number }> {
  await connectDB();

  const filter: Record<string, unknown> = {};
  if (q.action) filter.action = { $regex: q.action, $options: "i" };
  if (q.actorEmail) filter.actorEmail = { $regex: q.actorEmail, $options: "i" };
  if (q.targetType) filter["target.type"] = q.targetType;
  if (q.status) filter.status = q.status;
  if (q.from || q.to) {
    const createdAt: Record<string, Date> = {};
    if (q.from) createdAt.$gte = new Date(q.from);
    if (q.to) createdAt.$lte = new Date(q.to);
    filter.createdAt = createdAt;
  }

  const skip = (q.page - 1) * q.limit;
  const [docs, total] = await Promise.all([
    AuditLogModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(q.limit).lean(),
    AuditLogModel.countDocuments(filter),
  ]);

  return { items: (docs as unknown as RawAudit[]).map(toEntry), total };
}
