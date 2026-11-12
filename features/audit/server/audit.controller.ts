import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate } from "@/lib/server/http/validate";
import { requirePermission } from "@/lib/server/auth/access";

import * as service from "./audit.service";
import { auditQuerySchema } from "./audit.validators";


export const listAuditController = withErrorHandler(async (request: Request) => {
  await requirePermission("security.view");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = validate(auditQuerySchema, params);
  const { items, pagination } = await service.getAuditLogs(query);
  return ok(items, "Audit logs", { pagination });
});
