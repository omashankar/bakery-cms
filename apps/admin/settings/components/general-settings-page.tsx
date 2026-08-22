"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { GeneralSettings } from "@/types/settings";
import {
  businessTypeOptions,
  currencyOptions,
  defaultGeneralSettings,
  isSafeAssetUrl,
  timezoneOptions,
} from "@/features/settings/lib/settings-utils";
import {
  getGeneralSettings,
  resetGeneralSettings,
  saveGeneralSettings,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { SettingsSectionShell } from "./settings-section-shell";
import { FieldError, SettingsHydrationNotice } from "./settings-field-error";

/**
 * Everything the server will reject, checked here first.
 *
 * Without this the only feedback for an empty site name was a round-trip 422
 * surfaced as "saved on this device only — the server rejected it", which reads
 * like an outage rather than "you cleared a required field".
 */
function validate(settings: GeneralSettings) {
  const assetHint = "Use a path like /images/logo.svg or a full https:// URL.";
  return {
    siteName: settings.siteName.trim()
      ? ""
      : "Site name is required — it is the store name in the navbar, the browser tab and every email.",
    logo: isSafeAssetUrl(settings.logo) ? "" : assetHint,
    favicon: isSafeAssetUrl(settings.favicon) ? "" : assetHint,
  };
}

export function GeneralSettingsPage() {
  const router = useRouter();
  const { settings, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<GeneralSettings>(getGeneralSettings, defaultGeneralSettings);

  const errors = validate(settings);
  const hasErrors = Object.values(errors).some(Boolean);

  /**
   * The site name in the tab, the favicon, and the currency and timezone every
   * formatter uses are all read by the ROOT layout on the server. Nothing here
   * re-runs that, so without this the admin saves a new currency and keeps
   * seeing prices in the old one until they reload by hand.
   */
  function refreshServerRender() {
    router.refresh();
  }

  async function handleSave() {
    if (hasErrors || !canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveGeneralSettings(settings);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and greying it out removes the only retry.
      const accepted = reportSettingsWrite(persisted, "General settings");
      if (accepted) refreshServerRender();
      return { value, accepted };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetGeneralSettings();
      const accepted = reportSettingsReset(persisted, "General settings");
      if (accepted) refreshServerRender();
      return { value, accepted };
    });
  }

  return (
    <SettingsSectionShell
      title="General"
      description={
        hydration === "ready"
          ? `${settings.siteName} · ${
              businessTypeOptions.find((o) => o.value === settings.businessType)?.label ??
              settings.businessType
            } · ${settings.currency}`
          : "Site identity, business type, branding, timezone, and currency."
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed: editing the seed
      // makes the form dirty, the resync then skips it to protect the edit, and
      // Save pushes the seeded name/INR/Asia-Kolkata over the shop's own identity.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={hasErrors || !canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
    >
      <SettingsHydrationNotice hydration={hydration} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Site identity</CardTitle>
            <CardDescription>Shown in the navbar, footer, and browser title.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="siteName">Site name</Label>
              <Input
                id="siteName"
                value={settings.siteName}
                aria-invalid={Boolean(errors.siteName)}
                aria-describedby={errors.siteName ? "siteName-error" : undefined}
                className={cn(errors.siteName && "border-destructive")}
                onChange={(e) => edit((prev) => ({ ...prev, siteName: e.target.value }))}
              />
              <FieldError id="siteName-error" message={errors.siteName} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteTagline">Tagline</Label>
              <Input
                id="siteTagline"
                value={settings.siteTagline}
                onChange={(e) => edit((prev) => ({ ...prev, siteTagline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Description</Label>
              <textarea
                id="siteDescription"
                className={adminTextareaClassName}
                value={settings.siteDescription}
                onChange={(e) =>
                  edit((prev) => ({ ...prev, siteDescription: e.target.value }))
                }
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Branding &amp; locale</CardTitle>
            <CardDescription>Business type, logo paths, and regional defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="businessType">Business type</Label>
              <AdminSelect
                id="businessType"
                value={settings.businessType}
                onChange={(e) =>
                  edit((prev) => ({
                    ...prev,
                    businessType: e.target.value as GeneralSettings["businessType"],
                  }))
                }
              >
                {businessTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              <p className="text-xs text-muted-foreground">
                Controls public labels and which optional modules appear. Bakery keeps every feature on.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo">Logo URL</Label>
              <Input
                id="logo"
                value={settings.logo}
                aria-invalid={Boolean(errors.logo)}
                aria-describedby={errors.logo ? "logo-error" : undefined}
                className={cn(errors.logo && "border-destructive")}
                onChange={(e) => edit((prev) => ({ ...prev, logo: e.target.value }))}
                placeholder="/images/logo.svg"
              />
              <FieldError id="logo-error" message={errors.logo} />
              <p className="text-xs text-muted-foreground">
                Shown as the storefront mark. Leave empty to use the header&apos;s letter mark.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon URL</Label>
              <Input
                id="favicon"
                value={settings.favicon}
                aria-invalid={Boolean(errors.favicon)}
                aria-describedby={errors.favicon ? "favicon-error" : undefined}
                className={cn(errors.favicon && "border-destructive")}
                onChange={(e) => edit((prev) => ({ ...prev, favicon: e.target.value }))}
                placeholder="/favicon.ico"
              />
              <FieldError id="favicon-error" message={errors.favicon} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <AdminSelect
                id="timezone"
                value={settings.timezone}
                onChange={(e) => edit((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              <p className="text-xs text-muted-foreground">
                Dates and times across the admin and storefront are rendered in this zone.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <AdminSelect
                id="currency"
                value={settings.currency}
                onChange={(e) => edit((prev) => ({ ...prev, currency: e.target.value }))}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
              <p className="text-xs text-muted-foreground">
                Every price shown in the admin and the storefront is formatted in this currency.
                It does not convert existing amounts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsSectionShell>
  );
}
