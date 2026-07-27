import { writeAuditLog } from "@/lib/server/audit/audit-log";
import * as orderRepo from "@/features/orders/server/order.repository";
import { buildTransactions } from "@/features/payments/lib/transactions";
import { getPaymentAnalytics } from "@/features/payments/lib/payment-analytics";

import * as repo from "./payments.repository";
import type { InvoiceSettingsInput } from "./payments.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/**
 * Transactions and analytics are DERIVED from the orders collection (a payment
 * is a facet of its order), matching the app's existing projection design — no
 * separate ledger to drift out of sync.
 */
export async function getTransactions() {
  const orders = await orderRepo.listAll();
  return buildTransactions(orders);
}

export async function getAnalytics() {
  const orders = await orderRepo.listAll();
  return getPaymentAnalytics(orders);
}

// ---- Invoice settings (singleton) ----

export async function getInvoiceSettings() {
  const doc = await repo.getOrCreateInvoiceSettings();
  return doc.toJSON();
}

export async function updateInvoiceSettings(input: InvoiceSettingsInput, ctx: RequestCtx) {
  await repo.updateInvoiceSettings(input);
  await writeAuditLog({
    action: "payments.invoice_settings.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "invoice_settings", id: "singleton" },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return getInvoiceSettings();
}
