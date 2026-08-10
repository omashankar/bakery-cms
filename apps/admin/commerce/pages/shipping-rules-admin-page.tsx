"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { reportSettingsWrite } from "@/apps/admin/settings/lib/report-settings-write";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
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
import {
  DELIVERY_ZONES_UPDATED_EVENT,
  getDeliveryZoneStats,
  loadDeliveryZones,
} from "@/features/commerce/lib/delivery-zones-repository";

const SAMPLE_ITEM = {
  id: "preview",
  productSlug: "preview",
  name: "Sample cake",
  image: "",
  price: 850,
  quantity: 1,
};

const EMPTY_ZONE_STATS = { total: 0, active: 0, inactive: 0, cities: 0 };

export function ShippingRulesAdminPage() {
  // The shared section form — same reasoning as the Taxes screen. The
  // hand-rolled `load()` below skipped the resync while dirty, so on a cold load
  // the admin's first keystroke pinned the pre-hydration seed and Save pushed
  // the whole commerce section from it, including the tax rate this screen does
  // not show.
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<CommerceSettings>(getCommerceSettings, defaultCommerceSettings);
  /**
   * What CHECKOUT is doing, which is `saved`, not the draft on screen.
   *
   * The header and the banner read `settings` — the working copy — so flipping
   * the switch made the amber "Zone-based pricing is off" warning vanish and
   * the header read "Zone pricing on · 3 active zones" before anything was
   * saved. Both are statements about the live shop. The Taxes page beside this
   * one was already fixed to state its live value and flag the pending change;
   * this is the same treatment.
   */
  const liveZonePricing = saved.useZoneBasedDelivery;
  const zonePricingPending = settings.useZoneBasedDelivery !== saved.useZoneBasedDelivery;
  const [mounted, setMounted] = useState(false);
  const [previewPincode, setPreviewPincode] = useState("400001");
  const [previewCity, setPreviewCity] = useState("Mumbai");
  const [zoneStats, setZoneStats] = useState(EMPTY_ZONE_STATS);

  useEffect(() => {
    // Zone stats are display-only, and have their own store and event — the
    // settings form above is no longer this effect's business.
    function loadStats() {
      setZoneStats(getDeliveryZoneStats(loadDeliveryZones()));
    }
    loadStats();
    setMounted(true);
    window.addEventListener(DELIVERY_ZONES_UPDATED_EVENT, loadStats);
    return () => window.removeEventListener(DELIVERY_ZONES_UPDATED_EVENT, loadStats);
  }, []);

  const stats = mounted ? zoneStats : EMPTY_ZONE_STATS;

  const previewTotals = useMemo(
    () =>
      calculateCartTotals({
        items: [SAMPLE_ITEM],
        deliveryAddress: { city: previewCity, pincode: previewPincode },
        commerceOverride: settings,
      }),
    [previewCity, previewPincode, settings]
  );

  async function handleSave() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveCommerceSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and these rules are what the storefront
      // charges by.
      return { value, accepted: reportSettingsWrite(persisted, "Shipping rules") };
    });
  }

  function handleReset() {
    discard();
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Shipping Rules"
        description={
          hydration !== "ready"
            ? "How delivery is charged at checkout."
            : liveZonePricing
              ? `Zone pricing on · ${stats.active} active zones`
              : "Flat-fee shipping · zone pricing off"
        }
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {isDirty ? (
              <Button variant="outline" className="w-full sm:w-auto" onClick={handleReset}>
                Discard
              </Button>
            ) : null}
            <Button
              variant="bakery"
              className="w-full sm:w-auto"
              onClick={handleSave}
              disabled={!isDirty || !canSave}
            >
              {isWriting ? "Saving…" : "Save rules"}
            </Button>
          </div>
        }
      />

      <SettingsHydrationNotice hydration={hydration} />

      {hydration === "ready" && !liveZonePricing ? (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          Zone-based pricing is off. Checkout uses the default delivery fee until you enable
          zones below.{" "}
          <Link
            href={routes.admin.commerce.deliveryZones}
            className="font-medium underline underline-offset-2"
          >
            Review zones
          </Link>
        </div>
      ) : null}

      {/* The switch is flipped but nothing has changed at checkout yet — say so
          rather than letting the banner's disappearance imply it has. */}
      {zonePricingPending ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Not applied yet — save to{" "}
          {settings.useZoneBasedDelivery ? "apply zone pricing" : "go back to the flat fee"} at
          checkout.
        </div>
      ) : null}

      <SettingsFormGate hydration={hydration}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] xl:items-start">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Zone-based delivery</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                When enabled, checkout matches pincode or city to active zones (
                {stats.active} active), then falls back to the fee below.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="font-medium">Use delivery zones at checkout</p>
                  <p className="text-sm text-muted-foreground">
                    Match customer pincode or city to zone charges
                  </p>
                </div>
                <Switch
                  checked={settings.useZoneBasedDelivery}
                  onCheckedChange={(checked) =>
                    edit((prev) => ({ ...prev, useZoneBasedDelivery: checked === true }))
                  }
                />
              </label>
              <div className="space-y-2">
                <Label htmlFor="zone-fallback-fee">Fallback delivery fee (no zone match)</Label>
                <Input
                  id="zone-fallback-fee"
                  type="number"
                  min={0}
                  value={settings.zoneFallbackDeliveryFee}
                  onChange={(event) =>
                    edit((prev) => ({
                      ...prev,
                      zoneFallbackDeliveryFee: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Standard shipping rules</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Applied before zone overrides and free-delivery checks.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deliveryFee">Default delivery fee</Label>
                <Input
                  id="deliveryFee"
                  type="number"
                  min={0}
                  value={settings.deliveryFee}
                  onChange={(event) =>
                    edit((prev) => ({
                      ...prev,
                      deliveryFee: Math.max(0, Number(event.target.value) || 0),
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
                  onChange={(event) =>
                    edit((prev) => ({
                      ...prev,
                      freeDeliveryThreshold: Math.max(0, Number(event.target.value) || 0),
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
                  onChange={(event) =>
                    edit((prev) => ({
                      ...prev,
                      minOrderValue: Math.max(0, Number(event.target.value) || 0),
                    }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-full shadow-sm xl:sticky xl:top-24">
          <CardHeader>
            <CardTitle className="text-base">Checkout preview</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Sample {formatCurrency(850)} order with current rules.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="space-y-2">
                <Label htmlFor="preview-city">Preview city</Label>
                <Input
                  id="preview-city"
                  value={previewCity}
                  onChange={(event) => setPreviewCity(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preview-pincode">Preview pincode</Label>
                <Input
                  id="preview-pincode"
                  value={previewPincode}
                  onChange={(event) => setPreviewPincode(event.target.value)}
                />
              </div>
            </div>

            <TaxBreakdown
              values={{
                subtotal: previewTotals.subtotal,
                delivery: previewTotals.delivery,
                tax: previewTotals.tax,
                platformCharge: previewTotals.platformCharge,
                total: previewTotals.total,
                taxLabel: settings.taxLabel,
              }}
            />

            {/*
              Says what actually happened, in the order it happened.

              This read "No active zone matched — fallback fee applied" for every
              case where no zone NAME came back, which included an order over the
              free-delivery threshold: nothing had failed to match and no fee had
              been applied, yet the operator was told both.
            */}
            {previewTotals.deliveryZoneName ? (
              <p className="text-xs text-muted-foreground">
                Matched zone: <span className="font-medium">{previewTotals.deliveryZoneName}</span>
                {previewTotals.estimatedDeliveryDays
                  ? ` · Est. ${previewTotals.estimatedDeliveryDays} day(s)`
                  : ""}
                {previewTotals.delivery === 0 ? " · free at this cart value" : ""}
              </p>
            ) : !settings.useZoneBasedDelivery ? (
              <p className="text-xs text-muted-foreground">
                {previewTotals.delivery === 0
                  ? "Free at this cart value — flat fee otherwise."
                  : "Using default flat delivery fee."}
              </p>
            ) : previewTotals.delivery === 0 ? (
              // WHY it is zero, not just that it is. Attributing every zero to
              // the threshold was wrong for the zero FALLBACK this change set
              // made possible — the operator would have gone looking at the wrong
              // setting.
              <p className="text-xs text-muted-foreground">
                No active zone matched.{" "}
                {previewTotals.subtotal >= settings.freeDeliveryThreshold
                  ? "This cart is over the free-delivery threshold, so nothing is charged."
                  : "The fallback fee is set to zero, so nothing is charged."}
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No active zone matched — fallback fee applied.
              </p>
            )}

            <p className="text-xs text-muted-foreground">
              Free delivery above {formatCurrency(settings.freeDeliveryThreshold)}.
            </p>
          </CardContent>
        </Card>
      </div>
      </SettingsFormGate>
    </AdminPage>
  );
}
