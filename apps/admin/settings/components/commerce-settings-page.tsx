"use client";

import { useMemo } from "react";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import type { CommerceSettings } from "@/types/settings";
import { formatCurrency } from "@/utils/format";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import {
  getCommerceSettings,
  resetCommerceSettings,
  saveCommerceSettings,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { SettingsSectionShell } from "./settings-section-shell";
import { FieldError, SettingsHydrationNotice } from "./settings-field-error";

/** The same sample cart the Taxes and Shipping Rules previews price. */
const SAMPLE_ITEM = {
  id: "preview",
  productSlug: "preview",
  name: "Sample cake",
  image: "",
  price: 850,
  quantity: 1,
};

/** The order-number prefix rule, matching `commerceSchema` exactly. */
function validate(settings: CommerceSettings) {
  const prefix = settings.orderNumberPrefix.trim();
  return {
    // The server takes 1–8 characters after trimming. Nothing checked here, so
    // a blank or over-long prefix was a 422 that `reportSettingsWrite` phrased
    // as "saved on this device only" — which reads as an outage, not a typo,
    // and took the whole commerce section down with it.
    orderNumberPrefix:
      prefix.length === 0
        ? "Order numbers need a prefix — this is what every order is identified by."
        : prefix.length > 8
          ? "Keep the prefix to 8 characters or fewer."
          : "",
  };
}

export function CommerceSettingsPage() {
  // The shared section form, for the reasons written on it: this page held a
  // one-shot `useEffect` that read localStorage on mount and never listened for
  // hydration. `SettingsServerSync` reads the server copy from a root-layout
  // effect, so on a hard load that read was still in flight while these inputs
  // were already interactive — and `getCommerceSettings()` answers with the demo
  // seed in the meantime. One edit to the gift wrap fee then PUT the entire
  // commerce section from that seed: the tax rate, the delivery lead time, the
  // zone settings and the time slots are all in this section and none of them
  // are on this screen. The shop's real tax rate silently became the demo 5%.
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<CommerceSettings>(getCommerceSettings, defaultCommerceSettings);

  const errors = validate(settings);
  const hasErrors = Object.values(errors).some(Boolean);

  // The header status line describes what cart/checkout actually use, so it reads the
  // saved values — the Live preview below intentionally reflects the unsaved draft.
  //
  // `razorpay` was missing from this count while being the ONLY online method
  // checkout can actually take money with, so a shop with card and UPI off but
  // Razorpay on was told it had "0 payment methods".
  const livePaymentMethodsOn = [
    saved.paymentMethods.cod,
    saved.paymentMethods.upi,
    saved.paymentMethods.card,
    saved.paymentMethods.razorpay,
  ].filter(Boolean).length;

  // Priced by the same function checkout uses.
  //
  // This reimplemented delivery as `subtotal >= threshold ? 0 : deliveryFee`,
  // which knows nothing about delivery ZONES — so with zone pricing on, the
  // preview quoted a fee no customer would ever be charged. It also added the
  // gift wrap fee unconditionally, though gift wrap is an opt-in checkbox at
  // checkout, so the sample total was high for every customer who does not tick
  // it. `calculateCartTotals` answers both correctly.
  const previewTotals = useMemo(
    () =>
      calculateCartTotals({
        items: [SAMPLE_ITEM],
        commerceOverride: settings,
      }),
    [settings]
  );

  async function handleSave() {
    if (hasErrors || !canSave) return;
    // `runWrite` keeps the hydration listener from re-baselining `saved` while
    // this is in flight — the local write dispatches SETTINGS_UPDATED_EVENT
    // synchronously, long before the server answers.
    await runWrite(async () => {
      const { value, persisted } = await saveCommerceSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and greying it out removes the only retry.
      return { value, accepted: reportSettingsWrite(persisted, "Commerce settings") };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetCommerceSettings();
      return { value, accepted: reportSettingsReset(persisted, "Commerce settings") };
    });
  }

  return (
    <SettingsSectionShell
      title="Commerce"
      description={
        hydration === "ready"
          ? `Delivery ${formatCurrency(saved.deliveryFee)} · free above ${formatCurrency(saved.freeDeliveryThreshold)} · ${livePaymentMethodsOn} payment method${livePaymentMethodsOn === 1 ? "" : "s"}`
          : "Shipping, tax, payments, and delivery rules used across cart and checkout."
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Letting the
      // admin edit the seed and then skipping the correction (the resync skips a
      // dirty form) is how one keystroke pushed demo pricing over a real shop's.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={hasErrors || !canSave}
      // Names what actually goes. The default wording — "other settings sections
      // are not changed" — is true and misleading here: the commerce SECTION is
      // one PUT that spans three admin screens, so resetting from this one also
      // takes the tax rate, the delivery zones toggle and the time slots, none
      // of which are on this page.
      resetDescription="Replace ALL commerce settings with the demo defaults — including the tax rate, delivery zone rules and time slots, which live on the Taxes and Shipping Rules screens. Other settings sections are not changed."
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
      <SettingsHydrationNotice hydration={hydration} />
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
                    edit((prev) => ({
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
                    edit((prev) => ({
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
                    edit((prev) => ({
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
                    edit((prev) => ({ ...prev, giftWrapEnabled: checked }))
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
                      edit((prev) => ({ ...prev, giftWrapLabel: e.target.value }))
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
                      edit((prev) => ({
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
                    edit((prev) => ({ ...prev, orderNumberPrefix: e.target.value }))
                  }
                  placeholder="BK"
                  maxLength={8}
                  aria-invalid={Boolean(errors.orderNumberPrefix)}
                  aria-describedby={
                    errors.orderNumberPrefix ? "orderNumberPrefix-error" : undefined
                  }
                />
                <FieldError
                  id="orderNumberPrefix-error"
                  message={errors.orderNumberPrefix}
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
                    edit((prev) => ({ ...prev, checkoutTerms: e.target.value }))
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
            {/*
              Gift wrap is an opt-in checkbox at checkout, so the sample cart
              does not tick it and the fee is not in this total. It used to be
              added unconditionally, overstating the sample for every customer
              who does not choose it. What the fee IS still belongs here.
            */}
            {settings.giftWrapEnabled ? (
              <div className="flex justify-between text-muted-foreground">
                <span>{settings.giftWrapLabel} (if chosen)</span>
                <span>+{formatCurrency(settings.giftWrapFee)}</span>
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
                // Razorpay was left out of this list while being the only online
                // method checkout can actually collect with.
                settings.paymentMethods.razorpay && "Razorpay",
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
