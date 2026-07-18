"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AnalyticsSettings } from "@/types/settings";
import { defaultAnalyticsSettings } from "@/features/settings/lib/settings-utils";
import {
  getAnalyticsSettings,
  resetAnalyticsSettings,
  saveAnalyticsSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

/** Tracking IDs are machine values — mobile keyboards must not capitalize or correct them. */
const trackingIdProps = {
  spellCheck: false,
  autoCapitalize: "none",
  autoCorrect: "off",
} as const;

export function AnalyticsSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<AnalyticsSettings>(defaultAnalyticsSettings);
  const [savedSettings, setSavedSettings] = useState<AnalyticsSettings>(defaultAnalyticsSettings);

  useEffect(() => {
    const loaded = getAnalyticsSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const configuredCount = [
    settings.googleAnalyticsId,
    settings.googleTagManagerId,
    settings.facebookPixelId,
    settings.hotjarId,
  ].filter((id) => id.trim()).length;

  function handleSave() {
    const saved = saveAnalyticsSettings({
      googleAnalyticsId: settings.googleAnalyticsId.trim(),
      googleTagManagerId: settings.googleTagManagerId.trim(),
      facebookPixelId: settings.facebookPixelId.trim(),
      hotjarId: settings.hotjarId.trim(),
    });
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("Analytics settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetAnalyticsSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("Analytics settings reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Analytics"
      description={
        mounted
          ? `${configuredCount} of 4 integrations configured`
          : "Tracking IDs for analytics and marketing pixels (demo storage only)."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Tracking IDs</CardTitle>
          <CardDescription>
            Paste measurement IDs from Google Analytics, GTM, Meta Pixel, or Hotjar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ga">Google Analytics (GA4)</Label>
            <Input
              id="ga"
              value={settings.googleAnalyticsId}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, googleAnalyticsId: e.target.value }))
              }
              placeholder="G-XXXXXXXXXX"
              {...trackingIdProps}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gtm">Google Tag Manager</Label>
            <Input
              id="gtm"
              value={settings.googleTagManagerId}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, googleTagManagerId: e.target.value }))
              }
              placeholder="GTM-XXXXXXX"
              {...trackingIdProps}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pixel">Facebook Pixel</Label>
            <Input
              id="pixel"
              value={settings.facebookPixelId}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, facebookPixelId: e.target.value }))
              }
              placeholder="1234567890"
              inputMode="numeric"
              {...trackingIdProps}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hotjar">Hotjar Site ID</Label>
            <Input
              id="hotjar"
              value={settings.hotjarId}
              onChange={(e) => setSettings((prev) => ({ ...prev, hotjarId: e.target.value }))}
              placeholder="1234567"
              inputMode="numeric"
              {...trackingIdProps}
            />
          </div>
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
