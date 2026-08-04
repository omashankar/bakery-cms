import "server-only";

import { getInvoiceSettings } from "@/features/payments/server/payments.service";
import { mergeInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";
import type { InvoiceSettings } from "@/types/invoice";

/**
 * The seller identity to print on a customer's invoice, resolved on the SERVER.
 *
 * The customer's copy used to be built from `loadInvoiceSettings()` — a plain
 * localStorage read, in the customer's own browser. Nothing on the storefront
 * ever writes that key (`useInvoiceSettingsServerSync` runs only in the admin
 * layout) and `GET /api/payments/invoice-settings` requires an owner or admin
 * role, so a customer could not have fetched the real values even if the page
 * had tried. Every customer therefore printed the demo seed: the wrong company,
 * the wrong address, and a GSTIN that belonged to nobody — while the admin's
 * copy of the SAME order, hydrated, showed the shop's real identity. Two copies
 * of one invoice that disagreed about who issued it.
 *
 * Reading it here removes the browser from the question entirely.
 *
 * `getInvoiceSettings` already fills a blank identity from the shop's own
 * General/Contact settings, so the admin's copy and this one are decided in the
 * same place and cannot drift apart again.
 *
 * What this adds is the `show*` flags, honoured BEFORE the values leave the
 * server: a PAN the shop has chosen not to print is not sent to the browser at
 * all. The admin, who owns those flags, still sees both.
 */
export async function getPrintableInvoiceIdentity(): Promise<InvoiceSettings> {
  const stored = (await getInvoiceSettings()) as Partial<InvoiceSettings>;
  const merged = mergeInvoiceSettings(stored);

  return {
    ...merged,
    // Withheld, not just hidden. These are the shop's tax registrations; a
    // browser has no reason to receive one the invoice will not print.
    gstNumber: merged.showGstNumber ? merged.gstNumber : "",
    panNumber: merged.showPanNumber ? merged.panNumber : "",
  };
}
