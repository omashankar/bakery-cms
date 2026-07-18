"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminSelect, adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GeneralSettings } from "@/types/settings";
import {
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

  function handleSave() {
    const saved = saveGeneralSettings(settings);
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("General settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetGeneralSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("General settings reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="General"
      description={
        mounted
          ? `${settings.siteName} · ${settings.currency} · ${settings.timezone}`
          : "Site identity, branding, timezone, and currency."
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
            <CardDescription>Logo paths and regional defaults.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
