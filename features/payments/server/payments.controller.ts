import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./payments.service";
import { invoiceSettingsSchema } from "./payments.validators";

const PAYMENT_ROLES = ["owner", "admin"] as const;

export const transactionsController = withErrorHandler(async () => {
  await requireRole(...PAYMENT_ROLES);
  return ok(await service.getTransactions(), "Transactions");
});

export const analyticsController = withErrorHandler(async () => {
  await requireRole(...PAYMENT_ROLES);
  return ok(await service.getAnalytics(), "Payment analytics");
});

export const getInvoiceSettingsController = withErrorHandler(async () => {
  await requireRole(...PAYMENT_ROLES);
  return ok(await service.getInvoiceSettings(), "Invoice settings");
});

export const updateInvoiceSettingsController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...PAYMENT_ROLES);
  const input = validate(invoiceSettingsSchema, await readJson(request));
  const result = await service.updateInvoiceSettings(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Invoice settings saved");
});
