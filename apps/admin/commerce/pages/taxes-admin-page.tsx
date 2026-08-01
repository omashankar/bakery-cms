"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { reportSettingsWrite } from "@/apps/admin/settings/lib/report-settings-write";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import {
  buildDefaultTaxLabel,
  formatTaxRatePercent,
  isDerivedTaxLabel,
} from "@/features/commerce/lib/tax-utils";
import { TaxBreakdown } from "@/components/shared/tax-breakdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  getCommerceSettings,
  saveCommerceSettings,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import {
  SettingsFormGate,
  SettingsHydrationNotice,
} from "@/apps/admin/settings/components/settings-field-error";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import type { CommerceSettings } from "@/types/settings";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";

const SAMPLE_ITEM = {
  id: "preview",
  productSlug: "preview",
  name: "Sample cake",
  image: "",
  price: 850,
  quantity: 1,
};

export function TaxesAdminPage() {
  // The shared section form. The hand-rolled version below it had the exact bug
  // that hook exists for: `load()` skipped the resync while the form was dirty,
  // which is right for protecting unsaved edits and wrong on a cold load —
  // hydration is still in flight while these inputs are already interactive, so
  // the admin's first keystroke PINNED the demo seed, and Save then PUT the
  // whole commerce section from it. That section carries the delivery fees, the
  // gift wrap, the minimum order value, the time slots and the checkout terms,
  // none of which are on this screen. Setting a tax rate reset all of them.
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<CommerceSettings>(getCommerceSettings, defaultCommerceSettings);
  const [previewDiscount, setPreviewDiscount] = useState(50);
  const [previewDelivery, setPreviewDelivery] = useState(99);

  // The banner and status line describe what checkout actually charges, so they read
  // the saved value — an unsaved toggle hasn't changed any customer's total yet.
  const liveTaxEnabled = saved.taxEnabled;
  const taxTogglePending = settings.taxEnabled !== saved.taxEnabled;

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

  async function handleSave() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveCommerceSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and these rules are what the storefront
      // charges by.
      return { value, accepted: reportSettingsWrite(persisted, "Tax settings") };
    });
  }

  function handleDiscard() {
    discard();
  }

  function handleTaxRateChange(percent: number) {
    const taxRate = Math.max(0, Math.min(100, percent)) / 100;
    edit((prev) => ({
      ...prev,
      taxRate,
      // Only re-derive the label while it still IS the derived one. Rewriting a
      // label the shop had customised ("VAT", "Service tax") back to
      // "GST (n%)" on every rate change discarded their wording silently.
      taxLabel: isDerivedTaxLabel(prev.taxLabel, prev.taxRate)
        ? buildDefaultTaxLabel(taxRate)
        : prev.taxLabel,
    }));
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Taxes"
        description={
          liveTaxEnabled
            ? `${saved.taxLabel} · ${formatTaxRatePercent(saved.taxRate)}${
                saved.platformChargeEnabled
                  ? ` · ${saved.platformChargeLabel} ${formatCurrency(saved.platformChargeAmount)}`
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
              // `canSave` is false until the SERVER's copy has landed, and while
              // a write is in flight — the round-trip can take seconds on a cold
              // read, and an enabled button through all of it invites a second
              // click that races the first.
              disabled={!isDirty || !canSave}
            >
              {isWriting ? "Saving…" : "Save tax settings"}
            </Button>
          </div>
        }
      />

      <SettingsHydrationNotice hydration={hydration} />

      {!liveTaxEnabled ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Tax is off. Checkout, invoices, and order summaries do not show a tax line until you
          enable it below.
        </div>
      ) : null}

      <SettingsFormGate hydration={hydration}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">GST / sales tax</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Calculated on subtotal after discounts
                {settings.taxIncludeDelivery ? ", plus delivery" : ""}
                {settings.giftWrapEnabled ? ", plus gift wrap" : ""}. Platform charge is
                added after tax.
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
                    edit((prev) => ({ ...prev, taxEnabled: checked === true }))
                  }
                />
              </label>

              {taxTogglePending ? (
                <p className="text-xs text-muted-foreground">
                  {settings.taxEnabled
                    ? "Not applied yet — save to start charging tax at checkout."
                    : "Not applied yet — save to stop charging tax at checkout."}
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tax-rate">Tax rate (%)</Label>
                  <Input
                    id="tax-rate"
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    disabled={!settings.taxEnabled}
                    // Two decimals, matching `formatTaxRatePercent` in the hint
                    // below. At one decimal a shop that typed 8.25 had it
                    // silently restated to 8.3, and the hint then disagreed
                    // with the box it describes.
                    value={Math.round(settings.taxRate * 10000) / 100}
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
                      edit((prev) => ({ ...prev, taxLabel: event.target.value }))
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
                    edit((prev) => ({
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
                    edit((prev) => ({
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
                      edit((prev) => ({
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
                      edit((prev) => ({
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
      </SettingsFormGate>
    </AdminPage>
  );
}
