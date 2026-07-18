"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
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
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [savedSettings, setSavedSettings] = useState<CommerceSettings>(defaultCommerceSettings);
  const [previewPincode, setPreviewPincode] = useState("400001");
  const [previewCity, setPreviewCity] = useState("Mumbai");
  const [zoneStats, setZoneStats] = useState(EMPTY_ZONE_STATS);

  useEffect(() => {
    function load() {
      const loaded = getCommerceSettings();
      setSettings(loaded);
      setSavedSettings(loaded);
      setZoneStats(getDeliveryZoneStats(loadDeliveryZones()));
    }
    load();
    setMounted(true);
    window.addEventListener(SETTINGS_UPDATED_EVENT, load);
    window.addEventListener(DELIVERY_ZONES_UPDATED_EVENT, load);
    return () => {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, load);
      window.removeEventListener(DELIVERY_ZONES_UPDATED_EVENT, load);
    };
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
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

  function handleSave() {
    const saved = saveCommerceSettings(settings);
    setSettings(saved);
    setSavedSettings(saved);
    toast.success("Shipping rules saved");
  }

  function handleReset() {
    setSettings(savedSettings);
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Shipping Rules"
        description={
          settings.useZoneBasedDelivery
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
              disabled={!isDirty}
            >
              Save rules
            </Button>
          </div>
        }
      />

      {!settings.useZoneBasedDelivery ? (
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
                    setSettings((prev) => ({ ...prev, useZoneBasedDelivery: checked === true }))
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
                    setSettings((prev) => ({
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
                    setSettings((prev) => ({
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
                    setSettings((prev) => ({
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
                    setSettings((prev) => ({
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

            {previewTotals.deliveryZoneName ? (
              <p className="text-xs text-muted-foreground">
                Matched zone: <span className="font-medium">{previewTotals.deliveryZoneName}</span>
                {previewTotals.estimatedDeliveryDays
                  ? ` · Est. ${previewTotals.estimatedDeliveryDays} day(s)`
                  : ""}
              </p>
            ) : settings.useZoneBasedDelivery ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No active zone matched — fallback fee applied.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Using default flat delivery fee.</p>
            )}

            <p className="text-xs text-muted-foreground">
              Free delivery above {formatCurrency(settings.freeDeliveryThreshold)}.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminPage>
  );
}
