"use client";

import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
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
import { SettingsHydrationNotice } from "./settings-field-error";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";

/** Tracking IDs are machine values — mobile keyboards must not capitalize or correct them. */
const trackingIdProps = {
  spellCheck: false,
  autoCapitalize: "none",
  autoCorrect: "off",
} as const;

export function AnalyticsSettingsPage() {
  // The shared section form. This page hand-rolled it and never resynced: a
  // one-shot `[]`-dep effect read localStorage on mount, with no
  // SETTINGS_UPDATED_EVENT listener at all, so the form was stuck on whatever
  // that read returned for the whole page session. `SettingsServerSync` reads
  // the real copy from a root-layout effect, so on a hard load that read is
  // still in flight and the local store answers with the DEMO SEED — and Save
  // PUT the seed over the real section, which is a whole-section replace.
  //
  // The four tracking IDs default to empty strings, so what lands is all four
  // blanked: the storefront stops reporting to Google Analytics, GTM, Meta and
  // Hotjar, and the gap only surfaces as missing data days later.
  const { settings, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<AnalyticsSettings>(getAnalyticsSettings, defaultAnalyticsSettings);

  const configuredCount = [
    settings.googleAnalyticsId,
    settings.googleTagManagerId,
    settings.facebookPixelId,
    settings.hotjarId,
  ].filter((id) => id.trim()).length;

  async function handleSave() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveAnalyticsSettings({
        googleAnalyticsId: settings.googleAnalyticsId.trim(),
        googleTagManagerId: settings.googleTagManagerId.trim(),
        facebookPixelId: settings.facebookPixelId.trim(),
        hotjarId: settings.hotjarId.trim(),
      });
      return { value, accepted: reportSettingsWrite(persisted, "Analytics settings") };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetAnalyticsSettings();
      return { value, accepted: reportSettingsReset(persisted, "Analytics settings") };
    });
  }

  return (
    <SettingsSectionShell
      title="Analytics"
      description={
        hydration === "ready"
          ? `${configuredCount} of 4 integrations configured`
          : "Tracking IDs for analytics and marketing pixels."
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Gating only the
      // Save button leaves the gap open: the admin edits the seed, the arriving
      // values are skipped because the form is dirty, and Save unlocks over it.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={!canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
    >
      <SettingsHydrationNotice hydration={hydration} />
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
                edit((prev) => ({ ...prev, googleAnalyticsId: e.target.value }))
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
                edit((prev) => ({ ...prev, googleTagManagerId: e.target.value }))
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
                edit((prev) => ({ ...prev, facebookPixelId: e.target.value }))
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
              onChange={(e) => edit((prev) => ({ ...prev, hotjarId: e.target.value }))}
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
