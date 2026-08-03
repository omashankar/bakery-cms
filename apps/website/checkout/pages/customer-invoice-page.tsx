"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import { canViewOrder, readOrderLookupEmail } from "@/features/orders/lib/order-access";
import { getCustomerSession } from "@/apps/website/account/lib/customer-session";
import { emailInvoiceRequest, fetchOrderByNumber } from "@/features/orders/lib/orders-api";
import {
  getOrderByNumber,
  type PlacedOrder,
} from "@/features/orders/lib/orders";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import { runBrowserPrint } from "@/features/commerce/lib/print-invoice";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import type { InvoiceSettings } from "@/types/invoice";

interface CustomerInvoicePageProps {
  orderNumber: string;
  /**
   * The seller identity, resolved on the SERVER by the route above.
   *
   * This used to be `loadInvoiceSettings()` here in the browser, which seeds
   * demo constants when the key is absent — and on the storefront it always is.
   * Every customer printed a demo company and a fabricated GSTIN.
   */
  settings: InvoiceSettings;
}

export function CustomerInvoicePage({ orderNumber, settings }: CustomerInvoicePageProps) {
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [labels, setLabels] = useState({ tax: "", platform: "", giftwrap: "", taxRate: 0 });
  const [ready, setReady] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [emailing, setEmailing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Decided locally where we can, so the page does not flash a stranger's
    // order while the request is in flight — the same rule the order page uses.
    const local = getOrderByNumber(orderNumber);
    const sessionEmail = getCustomerSession()?.email;
    const localAllowed = local ? canViewOrder(local, sessionEmail) : false;

    setOrder(local);
    setAllowed(localAllowed);

    const c = getCommerceSettings();
    setLabels({
      tax: c.taxLabel,
      platform: c.platformChargeLabel,
      giftwrap: c.giftWrapLabel,
      taxRate: c.taxRate,
    });

    // Prefer the SERVER's copy. An invoice is the document a customer keeps, and
    // this browser's cache is frozen at placement — so after a refund it printed
    // the full original total with no mention of the money that had gone back.
    const email = readOrderLookupEmail(orderNumber) ?? sessionEmail;
    // Not ready until the server has answered, unless there is nothing to ask
    // with. Settling early rendered "Invoice not found" for a moment on an
    // order that was about to arrive — including any order the WEBHOOK placed,
    // which was never in this browser at all.
    if (!email) setReady(true);

    if (email) {
      void fetchOrderByNumber(orderNumber, { email }).then((fresh) => {
        if (cancelled) return;
        if (fresh) {
          setOrder(fresh);
          setAllowed(true);
        }
        setReady(true);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [orderNumber]);

  useEffect(() => {
    if (!printing) return;
    return runBrowserPrint(() => setPrinting(false));
  }, [printing]);

  /**
   * Really sends it now.
   *
   * This was a toast reading "Emailing invoices will be enabled with the
   * backend" — while the mail transport, the `invoice` template (seeded active
   * and editable in the admin) and the order lookup it needs all already
   * existed. The recipient is decided by the SERVER from the order, so the
   * button cannot be used to mail anyone else.
   */
  async function handleEmailInvoice() {
    if (!order || emailing) return;
    setEmailing(true);
    const result = await emailInvoiceRequest(order.orderNumber, {
      email: readOrderLookupEmail(order.orderNumber) ?? getCustomerSession()?.email,
    });
    setEmailing(false);

    if (!result.sent) {
      toast.error("Could not email the invoice", { description: result.error });
      return;
    }
    toast.success("Invoice sent", { description: `Check ${order.address.email}.` });
  }

  if (!ready) {
    return (
      <div className={layoutSpacing.container}>
        <div className="my-16 h-96 animate-pulse rounded-xl border border-border bg-cream-100" />
      </div>
    );
  }

  if (!order || !allowed) {
    return (
      <>
        <StorePageHeader title="Invoice" breadcrumbs={[{ label: "Invoice" }]} />
        <section className={layoutSpacing.sectionY}>
          <div className={layoutSpacing.containerNarrow}>
            <EmptyState
              icon={FileText}
              title="Invoice not found"
              description="We couldn't find an invoice for this order. It may have been placed on another device."
              action={
                <Button variant="bakery" render={<Link href={routes.store.orderTrack} />}>
                  Track an order
                </Button>
              }
            />
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <div className="print:hidden">
        <StorePageHeader
          title="Invoice"
          // The shop's own wording. This said "Tax invoice" whatever the
          // designer was set to — asserting a tax document above a page that
          // may correctly be headed plain "Invoice", for a shop with no
          // registration number to put on one.
          description={`${settings.invoiceTitle || "Invoice"} for order ${order.orderNumber}.`}
          breadcrumbs={[
            { label: "Order", href: routes.store.orderDetail(order.orderNumber) },
            { label: "Invoice" },
          ]}
        />
      </div>

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {/* Action bar — hidden when printing */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <Button
              variant="outline"
              render={<Link href={routes.store.orderDetail(order.orderNumber)} />}
            >
              <ArrowLeft className="size-4" />
              Back to order
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => void handleEmailInvoice()} disabled={emailing}>
                <Mail className="size-4" />
                {emailing ? "Sending…" : "Email invoice"}
              </Button>
              <Button variant="bakery" onClick={() => setPrinting(true)}>
                <Printer className="size-4" />
                Print / Download PDF
              </Button>
            </div>
          </div>

          {/* On-screen preview */}
          <div className="rounded-2xl bg-muted p-3 sm:p-4 print:hidden">
            <InvoiceDocument
              order={order}
              settings={settings}
              taxLabel={labels.tax}
              currentTaxRate={labels.taxRate}
              platformChargeLabel={labels.platform}
              giftWrapLabel={labels.giftwrap}
              variant="screen"
            />
          </div>

          {/* Print-only copy */}
          <div className="hidden print:block">
            <InvoiceDocument
              order={order}
              settings={settings}
              taxLabel={labels.tax}
              currentTaxRate={labels.taxRate}
              platformChargeLabel={labels.platform}
              giftWrapLabel={labels.giftwrap}
              variant="print"
            />
          </div>
        </div>
      </section>
    </>
  );
}
