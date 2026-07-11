"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import {
  buildDefaultTaxLabel,
  formatTaxRatePercent,
} from "@/features/admin/commerce/lib/tax-utils";
import { TaxBreakdown } from "@/components/shared/tax-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getCommerceSettings,
  saveCommerceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/admin/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/admin/settings/lib/settings-utils";
import { calculateCartTotals } from "@/features/storefront/checkout/lib/cart-totals";
import type { CommerceSettings } from "@/types/settings";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";

const SAMPLE_ITEM = {
  id: "preview",
  cakeSlug: "preview",
  name: "Sample cake",
  image: "",
  price: 850,
  quantity: 1,
};

export function TaxesAdminPage() {
  const [settings, setSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [savedSettings, setSavedSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [previewDiscount, setPreviewDiscount] = useState(50);
  const [previewDelivery, setPreviewDelivery] = useState(99);

  useEffect(() => {
    function load() {
      const loaded = getCommerceSettings();
      setSettings(loaded);
      setSavedSettings(loaded);
    }
    load();
    window.addEventListener(SETTINGS_UPDATED_EVENT, load);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, load);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  const previewTotals = useMemo(
    () =>
      calculateCartTotals({
        items: [SAMPLE_ITEM],
        discount: previewDiscount,
        commerceOverride: {
          ...settings,
          deliveryFee: previewDelivery,
          freeDeliveryThreshold: 99999,
        },
      }),
    [previewDelivery, previewDiscount, settings]
  );

  function handleSave() {
    const saved = saveCommerceSettings(settings);
    setSettings(saved);
    setSavedSettings(saved);
    toast.success("Tax settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
  }

  function handleTaxRateChange(percent: number) {
    const taxRate = Math.max(0, Math.min(100, percent)) / 100;
    setSettings((prev) => ({
      ...prev,
      taxRate,
      taxLabel: buildDefaultTaxLabel(taxRate),
    }));
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Taxes"
        description={
          settings.taxEnabled
            ? `${settings.taxLabel} · ${formatTaxRatePercent(settings.taxRate)}${
                settings.platformChargeEnabled
                  ? ` · ${settings.platformChargeLabel} ${formatCurrency(settings.platformChargeAmount)}`
                  : ""
              }`
            : "Tax disabled at checkout"
        }
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {isDirty ? (
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleDiscard}>
                Discard
              </Button>
            ) : null}
            <Button
              variant="bakery"
              className="w-full sm:w-auto"
              onClick={handleSave}
              disabled={!isDirty}
            >
              Save tax settings
            </Button>
          </div>
        }
      />

      {!settings.taxEnabled ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Tax is off. Checkout, invoices, and order summaries will not show a tax line until you
          enable it below.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">GST / sales tax</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Calculated on taxable amount after discounts
                {settings.taxIncludeDelivery ? ", including delivery" : ""}.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium">Enable tax</p>
                  <p className="text-sm text-muted-foreground">
                    Show tax line in checkout, invoices, and order summaries
                  </p>
                </div>
                <Switch
                  checked={settings.taxEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, taxEnabled: checked === true }))
                  }
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">Tax rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    disabled={!settings.taxEnabled}
                    value={Math.round(settings.taxRate * 1000) / 10}
                    onChange={(event) =>
                      handleTaxRateChange(Number(event.target.value) || 0)
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Current rate: {formatTaxRatePercent(settings.taxRate)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax-label">Tax label</Label>
                  <Input
                    id="tax-label"
                    disabled={!settings.taxEnabled}
                    value={settings.taxLabel}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, taxLabel: event.target.value }))
                    }
                    placeholder="GST (5%)"
                  />
                </div>
              </div>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium">Include delivery in taxable amount</p>
                  <p className="text-sm text-muted-foreground">
                    Tax applies to subtotal − discount + delivery
                  </p>
                </div>
                <Switch
                  checked={settings.taxIncludeDelivery}
                  disabled={!settings.taxEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      taxIncludeDelivery: checked === true,
                    }))
                  }
                />
              </label>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Platform charge</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Optional flat fee added after tax — marketplace or service fees.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium">Enable platform charge</p>
                  <p className="text-sm text-muted-foreground">
                    Separate line in the order breakdown
                  </p>
                </div>
                <Switch
                  checked={settings.platformChargeEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      platformChargeEnabled: checked === true,
                    }))
                  }
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="platform-label">Charge label</Label>
                  <Input
                    id="platform-label"
                    disabled={!settings.platformChargeEnabled}
                    value={settings.platformChargeLabel}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        platformChargeLabel: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platform-amount">Flat amount (₹)</Label>
                  <Input
                    id="platform-amount"
                    type="number"
                    min={0}
                    disabled={!settings.platformChargeEnabled}
                    value={settings.platformChargeAmount}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        platformChargeAmount: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-full shadow-sm xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">Live breakdown preview</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Sample {formatCurrency(850)} order with discount and delivery.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="preview-discount">Preview discount (₹)</Label>
                <Input
                  id="preview-discount"
                  type="number"
                  min={0}
                  value={previewDiscount}
                  onChange={(event) =>
                    setPreviewDiscount(Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-delivery">Preview delivery (₹)</Label>
                <Input
                  id="preview-delivery"
                  type="number"
                  min={0}
                  value={previewDelivery}
                  onChange={(event) =>
                    setPreviewDelivery(Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </div>
            </div>

            <TaxBreakdown
              showAllLines
              showTaxableAmount
              values={{
                subtotal: previewTotals.subtotal,
                discount: previewDiscount,
                discountLabel: "Sample discount",
                delivery: previewTotals.delivery,
                tax: previewTotals.tax,
                taxLabel: settings.taxLabel,
                platformCharge: previewTotals.platformCharge,
                platformChargeLabel: settings.platformChargeLabel,
                taxableAmount: previewTotals.taxableAmount,
                total: previewTotals.total,
              }}
            />

            <p className="text-xs text-muted-foreground">
              Same breakdown on checkout, order pages, and{" "}
              <Link
                href={routes.admin.commerce.invoices}
                className="font-medium text-primary hover:underline"
              >
                invoices
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
