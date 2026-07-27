import { z } from "zod";

/** Query params for the audit-log list endpoint. Strings coerce from the URL. */
export const auditQuerySchema = z.object({
  action: z.string().trim().min(1).optional(),
  actorEmail: z.string().trim().min(1).optional(),
  targetType: z.string().trim().min(1).optional(),
  status: z.enum(["success", "failure"]).optional(),
  from: z.string().trim().min(1).optional(),
  to: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
