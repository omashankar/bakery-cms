import { ok } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requirePermission } from "@/lib/server/auth/access";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./payments.service";
import { invoiceSettingsSchema, paymentAnalyticsQuerySchema } from "./payments.validators";


export const transactionsController = withErrorHandler(async () => {
  await requirePermission("payments.view");
  return ok(await service.getTransactions(), "Transactions");
});

export const analyticsController = withErrorHandler(async (request: Request) => {
  await requirePermission("payments.view");
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { timeZone } = validate(paymentAnalyticsQuerySchema, params);
  return ok(await service.getAnalytics(timeZone), "Payment analytics");
});

export const getInvoiceSettingsController = withErrorHandler(async () => {
  await requirePermission("payments.view");
  return ok(await service.getInvoiceSettings(), "Invoice settings");
});

export const updateInvoiceSettingsController = withErrorHandler(async (request: Request) => {
  const session = await requirePermission("payments.manage");
  const input = validate(invoiceSettingsSchema, await readJson(request));
  const result = await service.updateInvoiceSettings(input, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(result, "Invoice settings saved");
});
