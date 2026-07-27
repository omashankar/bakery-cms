import type { Pagination } from "@/lib/server/http/response";
import type { AuditLogEntry } from "@/types/audit";

import * as repo from "./audit.repository";
import type { AuditQueryInput } from "./audit.validators";

export async function getAuditLogs(
  query: AuditQueryInput,
): Promise<{ items: AuditLogEntry[]; pagination: Pagination }> {
  const { items, total } = await repo.list(query);
  const totalPages = Math.max(1, Math.ceil(total / query.limit));
  return {
    items,
    pagination: { page: query.page, limit: query.limit, total, totalPages },
  };
}
