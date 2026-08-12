"use client";

import { useEffect, useState } from "react";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { InvoiceDocument } from "@/components/shared/invoice-document";
import {
  INVOICE_SETTINGS_UPDATED_EVENT,
  loadInvoiceSettings,
} from "@/features/commerce/lib/invoice-settings-repository";
import { ensureInvoiceSettingsHydrated } from "@/features/commerce/lib/use-invoice-settings-server-sync";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { InvoiceSettings } from "@/types/invoice";
import { defaultInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";

interface OrderInvoiceProps {
  order: PlacedOrder;
  taxLabel?: string;
  platformChargeLabel?: string;
  giftWrapLabel?: string;
}

export function OrderInvoice({
  order,
  taxLabel,
  platformChargeLabel,
  giftWrapLabel,
}: OrderInvoiceProps) {
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(defaultInvoiceSettings);
  const [commerceLabels, setCommerceLabels] = useState({
    taxLabel: taxLabel ?? defaultCommerceSettings.taxLabel,
    platformChargeLabel: platformChargeLabel ?? defaultCommerceSettings.platformChargeLabel,
    giftWrapLabel: giftWrapLabel ?? defaultCommerceSettings.giftWrapLabel,
    // Only to check the order's OWN stored rate against, so a later rate change
    // cannot restate an invoice that was already issued.
    taxRate: defaultCommerceSettings.taxRate,
  });

  useEffect(() => {
    function refresh() {
      setInvoiceSettings(loadInvoiceSettings());
      const commerce = getCommerceSettings();
      setCommerceLabels({
        taxLabel: taxLabel ?? commerce.taxLabel,
        platformChargeLabel: platformChargeLabel ?? commerce.platformChargeLabel,
        giftWrapLabel: giftWrapLabel ?? commerce.giftWrapLabel,
        taxRate: commerce.taxRate,
      });
    }

    /**
     * Ask the server before printing, not just the cache.
     *
     * `loadInvoiceSettings()` returns the SEEDED demo identity when nothing has
     * hydrated — a company name, address and GSTIN belonging to no one. This is
     * the admin's print copy of a real order, so on a cold tab it went onto
     * paper with the wrong seller while the customer's copy of the same order
     * carried the shop's real one. Two invoices for one sale, disagreeing about
     * who sold it. `invoices-admin-page` and the invoice designer both await
     * this first.
     */
    void ensureInvoiceSettingsHydrated().then(refresh);
    refresh();
    window.addEventListener(INVOICE_SETTINGS_UPDATED_EVENT, refresh);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refresh);
    return () => {
      window.removeEventListener(INVOICE_SETTINGS_UPDATED_EVENT, refresh);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refresh);
    };
  }, [giftWrapLabel, platformChargeLabel, taxLabel]);

  return (
    <div className="hidden print:block" aria-hidden>
      <InvoiceDocument
        order={order}
        settings={invoiceSettings}
        taxLabel={commerceLabels.taxLabel}
        currentTaxRate={commerceLabels.taxRate}
        platformChargeLabel={commerceLabels.platformChargeLabel}
        giftWrapLabel={commerceLabels.giftWrapLabel}
        variant="print"
      />
    </div>
  );
}
