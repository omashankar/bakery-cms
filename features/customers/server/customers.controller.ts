import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requirePermission } from "@/lib/server/auth/access";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./customers.service";
import { customerMetaSchema } from "./customers.validators";

type EmailContext = { params: Promise<{ email: string }> };

export const listCustomersController = withErrorHandler(async () => {
  await requirePermission("customers.view");
  return ok(await service.getCustomers(), "Customers");
});

export const getCustomerController = withErrorHandler(async (_req: Request, ctx: EmailContext) => {
  await requirePermission("customers.view");
  const { email } = await ctx.params;
  return ok(await service.getCustomer(email), "Customer");
});

/**
 * The meta map alone, for the admin layout.
 *
 * `listCustomersController` answers the same question by reading every order
 * in the shop and deriving every profile, which is what the layout was calling
 * on entering the admin — for a field kept in its own small collection.
 */
export const listCustomerMetaController = withErrorHandler(async () => {
  await requirePermission("customers.view");
  return ok(await service.getCustomerMeta(), "Customer notes");
});

export const saveCustomerMetaController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("customers.update");
  const input = validate(customerMetaSchema, await readJson(request));
  const saved = await service.saveMeta(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(saved, "Customer updated");
});
