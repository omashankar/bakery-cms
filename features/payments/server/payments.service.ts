import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { DEFAULT_TIME_ZONE } from "@/features/orders/lib/viewer-time";
import * as orderRepo from "@/features/orders/server/order.repository";
import { buildTransactions } from "@/features/payments/lib/transactions";
import { getPaymentAnalytics } from "@/features/payments/lib/payment-analytics";
import { getSettings } from "@/features/settings/server/settings.service";

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
/**
 * One transaction per order, over every order.
 *
 * `listAll` capped this at the most recent 500, which silently truncated the
 * Transaction Center — the missing rows looked like transactions that never
 * happened rather than a page that ended.
 */
export async function getTransactions() {
  const orders = await orderRepo.listSince(null);
  return buildTransactions(orders);
}

/**
 * Collection totals, success/refund rates and the method split.
 *
 * These are sums over the whole ledger, so a cap does not make them smaller and
 * obviously wrong — it makes them smaller and plausible, which is worse.
 */
export async function getAnalytics(timeZone: string = DEFAULT_TIME_ZONE) {
  const orders = await orderRepo.listSince(null);
  return getPaymentAnalytics(orders, timeZone);
}

// ---- Invoice settings (singleton) ----

export async function getInvoiceSettings() {
  const doc = await repo.getOrCreateInvoiceSettings();
  const stored = doc.toJSON() as Record<string, unknown>;
  const settings = ((await getSettings()) ?? {}) as unknown as Record<
    string,
    Record<string, unknown>
  >;
  const general = settings.general ?? {};
  const contact = settings.contact ?? {};

  // A brand new shop's identity, from the settings it HAS already filled in.
  //
  // `getOrCreateInvoiceSettings` creates the singleton with every identity
  // field blank, and hydration merges that over the local copy — so a fresh
  // install printed invoices with an empty company block, and the storefront
  // and the admin disagreed about the seller. Falling back to the shop's own
  // General/Contact settings is better than either: the first invoice carries
  // the shop's real name without anyone having to visit the designer, and both
  // copies of the document agree because this is the one place it is decided.
  return {
    ...stored,
    companyName: firstNonBlank(stored.companyName, general.siteName),
    tagline: firstNonBlank(stored.tagline, general.siteTagline),
    address: firstNonBlank(stored.address, contact.address),
    email: firstNonBlank(stored.email, contact.email),
    phone: firstNonBlank(stored.phone, contact.phone),
    logoUrl: firstNonBlank(stored.logoUrl, general.logo),
  };
}

/** First non-blank string, else "" — never `undefined`, which spreads badly. */
function firstNonBlank(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
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
