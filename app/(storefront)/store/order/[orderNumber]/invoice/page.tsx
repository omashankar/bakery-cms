import type { Metadata } from "next";
import { CustomerInvoicePage } from "@/apps/website/checkout/pages/customer-invoice-page";
import { getPrintableInvoiceIdentity } from "@/features/commerce/server/invoice-identity.server";

export const metadata: Metadata = {
  title: "Invoice",
  description: "Download or print your order invoice.",
};

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function Page({ params }: PageProps) {
  const { orderNumber } = await params;
  // Resolved HERE, not in the customer's browser.
  //
  // The page used to call `loadInvoiceSettings()` — a localStorage read that
  // SEEDS demo constants when the key is absent, which on the storefront it
  // always is: nothing outside the admin layout ever writes it, and the
  // invoice-settings endpoint requires an admin role, so the page could not
  // have fetched the real values even if it had tried. Every customer's
  // invoice was therefore headed with a demo company, a demo address and a
  // fabricated GSTIN, while the admin's copy of the same order — hydrated —
  // showed the shop's real identity.
  const settings = await getPrintableInvoiceIdentity();
  return (
    <CustomerInvoicePage orderNumber={decodeURIComponent(orderNumber)} settings={settings} />
  );
}
