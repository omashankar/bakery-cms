"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminTextareaClassName } from "@/features/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { computeTaxAmount } from "@/features/commerce/lib/tax-utils";
import type { CommerceSettings } from "@/types/settings";
import { formatCurrency } from "@/utils/format";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  getCommerceSettings,
  resetCommerceSettings,
  saveCommerceSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

export function CommerceSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [savedSettings, setSavedSettings] = useState<CommerceSettings>(defaultCommerceSettings);

  useEffect(() => {
    const loaded = getCommerceSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // The header status line describes what cart/checkout actually use, so it reads the
  // saved values — the Live preview below intentionally reflects the unsaved draft.
  const livePaymentMethodsOn = [
    savedSettings.paymentMethods.cod,
    savedSettings.paymentMethods.upi,
    savedSettings.paymentMethods.card,
  ].filter(Boolean).length;

  const previewTotals = useMemo(() => {
    const sampleSubtotal = 850;
    const delivery =
      sampleSubtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
    const { tax } = computeTaxAmount(settings, {
      subtotal: sampleSubtotal,
      delivery,
    });
    const platformCharge = settings.platformChargeEnabled ? settings.platformChargeAmount : 0;
    const giftWrapFee = settings.giftWrapEnabled ? settings.giftWrapFee : 0;
    return {
      delivery,
      tax,
      platformCharge,
      giftWrapFee,
      total: sampleSubtotal + delivery + tax + platformCharge + giftWrapFee,
    };
  }, [settings]);

  function handleSave() {
    const saved = saveCommerceSettings(settings);
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("Commerce settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetCommerceSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("Commerce settings reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Commerce"
      description={
        mounted
          ? `Delivery ${formatCurrency(savedSettings.deliveryFee)} · free above ${formatCurrency(savedSettings.freeDeliveryThreshold)} · ${livePaymentMethodsOn} payment method${livePaymentMethodsOn === 1 ? "" : "s"}`
          : "Shipping, tax, payments, and delivery rules used across cart and checkout."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Shipping & delivery fees</CardTitle>
              <CardDescription>
                Controls delivery charges shown in cart and checkout summaries.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Standard delivery fee</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  min={0}
                  value={settings.deliveryFee}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      deliveryFee: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="freeDeliveryThreshold">Free delivery above</Label>
                <Input
                  id="freeDeliveryThreshold"
                  type="number"
                  min={0}
                  value={settings.freeDeliveryThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      freeDeliveryThreshold: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="minOrderValue">Minimum order value</Label>
                <Input
                  id="minOrderValue"
                  type="number"
                  min={0}
                  value={settings.minOrderValue}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      minOrderValue: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 to disable minimum order enforcement.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Gift wrap</CardTitle>
              <CardDescription>
                Optional add-on shown on the cart page during checkout.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Enable gift wrap</p>
                  <p className="text-xs text-muted-foreground">
                    Customers can add premium packaging to their order.
                  </p>
                </div>
                <Switch
                  checked={settings.giftWrapEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, giftWrapEnabled: checked }))
                  }
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="giftWrapLabel">Label</Label>
                  <Input
                    id="giftWrapLabel"
                    value={settings.giftWrapLabel}
                    disabled={!settings.giftWrapEnabled}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, giftWrapLabel: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="giftWrapFee">Fee (INR)</Label>
                  <Input
                    id="giftWrapFee"
                    type="number"
                    min={0}
                    disabled={!settings.giftWrapEnabled}
                    value={settings.giftWrapFee}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        giftWrapFee: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Orders & checkout copy</CardTitle>
              <CardDescription>Order numbering and customer-facing checkout message.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderNumberPrefix">Order number prefix</Label>
                <Input
                  id="orderNumberPrefix"
                  value={settings.orderNumberPrefix}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, orderNumberPrefix: e.target.value }))
                  }
                  placeholder="BK"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="checkoutTerms">Checkout terms message</Label>
                <textarea
                  id="checkoutTerms"
                  className={adminTextareaClassName}
                  rows={4}
                  value={settings.checkoutTerms}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, checkoutTerms: e.target.value }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit shadow-sm xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">Live preview</CardTitle>
            <CardDescription>
              Sample order at {formatCurrency(850)} subtotal with current rules.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery</span>
              <span>
                {previewTotals.delivery === 0
                  ? "Free"
                  : formatCurrency(previewTotals.delivery)}
              </span>
            </div>
            {settings.taxEnabled ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{settings.taxLabel}</span>
                <span>{formatCurrency(previewTotals.tax)}</span>
              </div>
            ) : null}
            {settings.platformChargeEnabled ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{settings.platformChargeLabel}</span>
                <span>{formatCurrency(previewTotals.platformCharge)}</span>
              </div>
            ) : null}
            {settings.giftWrapEnabled ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{settings.giftWrapLabel}</span>
                <span>{formatCurrency(previewTotals.giftWrapFee)}</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-border pt-2 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(previewTotals.total)}</span>
            </div>
            <p className="pt-2 text-xs text-muted-foreground">
              Free delivery above {formatCurrency(settings.freeDeliveryThreshold)}.
              {settings.minOrderValue > 0
                ? ` Minimum order ${formatCurrency(settings.minOrderValue)}.`
                : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {[
                settings.paymentMethods.cod && "COD",
                settings.paymentMethods.upi && "UPI",
                settings.paymentMethods.card && "Card",
              ]
                .filter(Boolean)
                .join(" · ") || "No payment methods enabled"}
            </p>
          </CardContent>
        </Card>
      </div>
    </SettingsSectionShell>
  );
}
