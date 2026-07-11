"use client";

import { useEffect, useState } from "react";
import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { InvoiceDocument } from "@/features/admin/commerce/components/invoice-document";
import {
  INVOICE_SETTINGS_UPDATED_EVENT,
  loadInvoiceSettings,
} from "@/features/admin/commerce/lib/invoice-settings-repository";
import {
  getCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/admin/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import type { InvoiceSettings } from "@/types/invoice";
import { defaultInvoiceSettings } from "@/features/admin/commerce/lib/invoice-defaults";

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
  });

  useEffect(() => {
    function refresh() {
      setInvoiceSettings(loadInvoiceSettings());
      const commerce = getCommerceSettings();
      setCommerceLabels({
        taxLabel: taxLabel ?? commerce.taxLabel,
        platformChargeLabel: platformChargeLabel ?? commerce.platformChargeLabel,
        giftWrapLabel: giftWrapLabel ?? commerce.giftWrapLabel,
      });
    }

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
        platformChargeLabel={commerceLabels.platformChargeLabel}
        giftWrapLabel={commerceLabels.giftWrapLabel}
        variant="print"
      />
    </div>
  );
}
