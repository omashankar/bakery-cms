"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeneralSettings } from "@/types/settings";
import {
  businessTypeOptions,
  currencyOptions,
  defaultGeneralSettings,
  timezoneOptions,
} from "@/features/settings/lib/settings-utils";
import {
  getGeneralSettings,
  resetGeneralSettings,
  saveGeneralSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

export function GeneralSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<GeneralSettings>(defaultGeneralSettings);
  const [savedSettings, setSavedSettings] = useState<GeneralSettings>(defaultGeneralSettings);

  useEffect(() => {
    const loaded = getGeneralSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  async function handleSave() {
    const { value, persisted } = await saveGeneralSettings(settings);
    setSettings(value);
    // Only mark clean when the SERVER has it — the dirty flag is what keeps the
    // Save button enabled, and greying it out would remove the only retry.
    if (reportSettingsWrite(persisted, "General settings")) setSavedSettings(value);
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    const { value, persisted } = await resetGeneralSettings();
    setSettings(value);
    if (reportSettingsReset(persisted, "General settings")) setSavedSettings(value);
  }

  return (
    <SettingsSectionShell
      title="General"
      description={
        mounted
          ? `${settings.siteName} · ${
              businessTypeOptions.find((o) => o.value === settings.businessType)?.label ??
              settings.businessType
            } · ${settings.currency}`
          : "Site identity, business type, branding, timezone, and currency."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
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
                onChange={(e) => setSettings((prev) => ({ ...prev, siteName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteTagline">Tagline</Label>
              <Input
                id="siteTagline"
                value={settings.siteTagline}
                onChange={(e) => setSettings((prev) => ({ ...prev, siteTagline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="siteDescription">Description</Label>
              <textarea
                id="siteDescription"
                className={adminTextareaClassName}
                value={settings.siteDescription}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, siteDescription: e.target.value }))
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
                  setSettings((prev) => ({
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
                onChange={(e) => setSettings((prev) => ({ ...prev, logo: e.target.value }))}
                placeholder="/images/logo.svg"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon">Favicon URL</Label>
              <Input
                id="favicon"
                value={settings.favicon}
                onChange={(e) => setSettings((prev) => ({ ...prev, favicon: e.target.value }))}
                placeholder="/favicon.ico"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <AdminSelect
                id="timezone"
                value={settings.timezone}
                onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {timezoneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <AdminSelect
                id="currency"
                value={settings.currency}
                onChange={(e) => setSettings((prev) => ({ ...prev, currency: e.target.value }))}
              >
                {currencyOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </AdminSelect>
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsSectionShell>
  );
}
