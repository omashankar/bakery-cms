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
import {
  extractTrackingId,
  type TrackingIdKind,
} from "@/features/settings/lib/tracking-id";
import { SettingsSectionShell } from "./settings-section-shell";
import { SettingsHydrationNotice } from "./settings-field-error";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";

/** Tracking IDs are machine values — mobile keyboards must not capitalize or correct them. */
const trackingIdProps = {
  spellCheck: false,
  autoCapitalize: "none",
  autoCorrect: "off",
} as const;

/**
 * Pull the id out of whatever was pasted, once the box is left.
 *
 * On blur rather than on change: rewriting mid-keystroke would fight a shop
 * typing "G-" by hand. By blur the value is finished.
 */
function settle(
  kind: TrackingIdKind,
  value: string,
  apply: (next: string) => void,
) {
  const id = extractTrackingId(value, kind);
  if (id !== value.trim()) apply(id);
}

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
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<AnalyticsSettings>(getAnalyticsSettings, defaultAnalyticsSettings);

  /**
   * What is SAVED, not what is typed.
   *
   * This read `settings` — the unsaved draft — so the header claimed
   * "1 of 4 integrations configured" the moment an id was typed, before
   * anything was stored and while the tracking script was still absent from
   * every page. The SMTP and Security headers beside it already count `saved`.
   */
  const configuredCount = [
    saved.googleAnalyticsId,
    saved.googleTagManagerId,
    saved.facebookPixelId,
    saved.hotjarId,
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
          {/*
            Google hands the shop a whole <script> block, not a bare id — so
            pasting that block here is the obvious thing to do. It used to be
            accepted, saved, echoed back and counted as configured on the
            settings index, while the storefront rendered nothing: the server
            drops any stored value that is not a bare id, correctly and in
            silence, a server away from the person who pasted it.
          */}
          <CardDescription>
            Paste what your provider gives you. If it is a whole script block, the
            id is picked out of it when you leave the box. An empty box tracks
            nothing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ga">Google Analytics (GA4)</Label>
            <Input
              id="ga"
              onBlur={(e) =>
                settle("ga4", e.target.value, (next) =>
                  edit((prev) => ({ ...prev, googleAnalyticsId: next })),
                )
              }
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
              onBlur={(e) =>
                settle("gtm", e.target.value, (next) =>
                  edit((prev) => ({ ...prev, googleTagManagerId: next })),
                )
              }
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
              onBlur={(e) =>
                settle("pixel", e.target.value, (next) =>
                  edit((prev) => ({ ...prev, facebookPixelId: next })),
                )
              }
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
              onBlur={(e) =>
                settle("hotjar", e.target.value, (next) =>
                  edit((prev) => ({ ...prev, hotjarId: next })),
                )
              }
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
