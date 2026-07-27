import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./customers.service";
import { customerMetaSchema } from "./customers.validators";

const CUSTOMER_ROLES = ["owner", "admin"] as const;
type EmailContext = { params: Promise<{ email: string }> };

export const listCustomersController = withErrorHandler(async () => {
  await requireRole(...CUSTOMER_ROLES);
  return ok(await service.getCustomers(), "Customers");
});

export const getCustomerController = withErrorHandler(async (_req: Request, ctx: EmailContext) => {
  await requireRole(...CUSTOMER_ROLES);
  const { email } = await ctx.params;
  return ok(await service.getCustomer(email), "Customer");
});

export const saveCustomerMetaController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...CUSTOMER_ROLES);
  const input = validate(customerMetaSchema, await readJson(request));
  const saved = await service.saveMeta(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(saved, "Customer updated");
});
