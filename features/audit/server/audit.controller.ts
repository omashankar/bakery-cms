import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";

import * as service from "./audit.service";
import { auditQuerySchema } from "./audit.validators";

const AUDIT_ROLES = ["owner", "admin"] as const;

export const listAuditController = withErrorHandler(async (request: Request) => {
  await requireRole(...AUDIT_ROLES);
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = validate(auditQuerySchema, params);
  const { items, pagination } = await service.getAuditLogs(query);
  return ok(items, "Audit logs", { pagination });
});
