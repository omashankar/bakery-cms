"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Mail, Printer } from "lucide-react";
import { toast } from "sonner";
import {
  getOrderByNumber,
  type PlacedOrder,
} from "@/features/storefront/checkout/lib/orders";
import { loadInvoiceSettings } from "@/features/admin/commerce/lib/invoice-settings-repository";
import { getCommerceSettings } from "@/features/admin/settings/lib/settings-repository";
import { InvoiceDocument } from "@/features/admin/commerce/components/invoice-document";
import { runBrowserPrint } from "@/features/admin/commerce/lib/print-invoice";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import type { InvoiceSettings } from "@/types/invoice";

interface CustomerInvoicePageProps {
  orderNumber: string;
}

export function CustomerInvoicePage({ orderNumber }: CustomerInvoicePageProps) {
  const [order, setOrder] = useState<PlacedOrder | null>(null);
  const [settings, setSettings] = useState<InvoiceSettings | null>(null);
  const [labels, setLabels] = useState({ tax: "", platform: "", giftwrap: "" });
  const [ready, setReady] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    setOrder(getOrderByNumber(orderNumber));
    setSettings(loadInvoiceSettings());
    const c = getCommerceSettings();
    setLabels({ tax: c.taxLabel, platform: c.platformChargeLabel, giftwrap: c.giftWrapLabel });
    setReady(true);
  }, [orderNumber]);

  useEffect(() => {
    if (!printing) return;
    return runBrowserPrint(() => setPrinting(false));
  }, [printing]);

  if (!ready) {
    return (
      <div className={layoutSpacing.container}>
        <div className="my-16 h-96 animate-pulse rounded-xl border border-border bg-cream-100" />
      </div>
    );
  }

  if (!order || !settings) {
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
          description={`Tax invoice for order ${order.orderNumber}.`}
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
              <Button
                variant="outline"
                onClick={() =>
                  toast.message("Email invoice", {
                    description: "Emailing invoices will be enabled with the backend.",
                  })
                }
              >
                <Mail className="size-4" />
                Email invoice
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
