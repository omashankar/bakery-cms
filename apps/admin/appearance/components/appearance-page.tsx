"use client";

import { useEffect, useMemo } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AppearanceSettings } from "@/types/appearance";
import { SettingsSectionShell } from "@/apps/admin/settings/components/settings-section-shell";
import { useHydratedForm } from "@/features/settings/lib/use-hydrated-form";
import { siteLayoutHydration } from "@/features/site-layout/lib/site-layout-api";
import { ensureSiteLayoutHydrated } from "@/components/shared/site-layout-server-sync";
import { SettingsHydrationNotice } from "@/apps/admin/settings/components/settings-field-error";
import {
  loadAppearanceSettings,
  resetAppearanceSettings,
  saveAppearanceSettings,
} from "@/features/site-layout/lib/appearance-repository";
import {
  applyAppearanceSettings,
  appearancePresets,
  defaultAppearanceSettings,
  getAppearanceOverview,
  getPresetById,
  hasValidAppearanceColors,
  isValidHexColor,
  normalizeHexColor,
  resolvePresetFromColors,
  settingsFromPreset,
  type AppearanceOverview,
} from "@/features/site-layout/lib/appearance-utils";
import { APPEARANCE_UPDATED_EVENT } from "@/features/site-layout/lib/appearance-utils";
import { AppearancePreview } from "./appearance-preview";

const EMPTY_OVERVIEW: AppearanceOverview = {
  presetLabel: "—",
  isCustom: false,
  borderRadius: 12,
  primaryColor: "#6f4e37",
  accentColor: "#d4a373",
};

const COLOR_FIELDS = [
  { key: "primaryColor" as const, label: "Primary brown", hint: "Buttons, links, brand marks" },
  { key: "accentColor" as const, label: "Gold accent", hint: "Focus rings and highlights" },
  { key: "surfaceColor" as const, label: "Cream surface", hint: "Soft backgrounds and panels" },
];

export function AppearancePage() {
  // The shared hydrated form. This page hand-rolled it: a one-shot `[]`-dep
  // effect read localStorage on mount and declared the form ready in the same
  // tick. `SiteLayoutServerSync` reads the server's copy from a root-layout
  // effect, so on a hard load that read is still in flight and
  // `loadAppearanceSettings()` answers with the DEMO PALETTE — and saving is a
  // replace-all, so one preset click pushed demo brand colours over the shop's
  // storefront theme.
  const {
    value: settings,
    // The last palette the SERVER confirmed. The preview falls back to it while
    // a colour field is mid-typing, instead of to the demo defaults.
    saved,
    isDirty,
    hydration,
    isWriting,
    canSave,
    edit: setSettings,
    discard,
    runWrite,
  } = useHydratedForm<AppearanceSettings>({
    read: loadAppearanceSettings,
    fallback: defaultAppearanceSettings,
    gate: siteLayoutHydration,
    ensureHydrated: ensureSiteLayoutHydrated,
    updatedEvent: APPEARANCE_UPDATED_EVENT,
  });

  useEffect(() => {
    // Nothing to preview until the server's palette has landed — applying the
    // seed would repaint the admin in demo colours for the duration.
    if (hydration === "pending") return;
    if (!hasValidAppearanceColors(settings)) return;
    applyAppearanceSettings(settings);
    return () => {
      applyAppearanceSettings(loadAppearanceSettings());
    };
  }, [settings, hydration]);

  const overview = useMemo(
    () => (hydration === "pending" ? EMPTY_OVERVIEW : getAppearanceOverview(settings)),
    [hydration, settings]
  );

  const activePresetId = resolvePresetFromColors(settings);
  const activePreset = getPresetById(activePresetId);

  function updateColor(
    key: "primaryColor" | "accentColor" | "surfaceColor",
    value: string
  ) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      return {
        ...next,
        preset: resolvePresetFromColors(next),
      };
    });
  }

  function updateBorderRadius(borderRadius: AppearanceSettings["borderRadius"]) {
    setSettings((prev) => ({
      ...prev,
      borderRadius,
      // Radius is independent — keep / re-resolve preset from colors only
      preset: resolvePresetFromColors(prev),
    }));
  }

  function selectPreset(presetId: AppearanceSettings["preset"]) {
    if (presetId === "custom") return;
    setSettings((prev) => ({
      ...settingsFromPreset(presetId),
      borderRadius: prev.borderRadius,
    }));
  }

  async function handleSave() {
    if (!hasValidAppearanceColors(settings)) {
      toast.error("Use valid hex colors (e.g. #6f4e37)");
      return;
    }

    const normalized: AppearanceSettings = {
      ...settings,
      primaryColor: normalizeHexColor(settings.primaryColor),
      accentColor: normalizeHexColor(settings.accentColor),
      surfaceColor: normalizeHexColor(settings.surfaceColor),
      borderRadius: settings.borderRadius === 16 ? 16 : 12,
      preset: resolvePresetFromColors(settings),
    };

    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveAppearanceSettings(normalized);
      // The storefront renders these colours from the SERVER copy, so only mark
      // clean once it has them — otherwise Save greys out with nothing saved.
      return {
        value,
        accepted: reportWrite(
          persisted,
          "Appearance saved — storefront uses these colors (light only)",
          {
            // The store rolls the local change back, so "saved on this
            // device only" would be wrong: the change is nowhere.
            failure: "Appearance was not saved — the server rejected it",
          },
        ),
      };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    // The Reset button lives in the page header, outside the gated form, so
    // it is reachable before hydration. It used to return here in silence:
    // the admin confirmed a destructive dialog, the dialog closed, and
    // nothing happened or was said.
    if (!canSave) {
      toast.error("Saved appearance hasn't loaded yet", {
        description: "Reset is unavailable until this page can reach the server.",
      });
      return;
    }
    await runWrite(async () => {
      const { value, persisted } = await resetAppearanceSettings();
      return {
        value,
        accepted: reportWrite(persisted, "Appearance reset to defaults", {
          failure: "Appearance was not reset — the server rejected it",
        }),
      };
    });
  }

  return (
    <SettingsSectionShell
      title="Appearance"
      description={
        hydration === "ready"
          ? `Storefront brand (light only) · ${overview.presetLabel} · ${overview.borderRadius}px radius · ${overview.isCustom ? "custom colors" : "preset palette"}`
          : "Storefront brand colors and shape — light mode only, never dark"
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Gating only the
      // Save button leaves the gap open: the admin picks a preset, the arriving
      // palette is skipped because the form is dirty, and Save unlocks over it.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
      saveDisabled={!hasValidAppearanceColors(settings) || !canSave}
      resetTitle="Reset appearance?"
      resetDescription="Restore the Classic Bakery preset and default radius. Custom colors will be lost."
    >
      <SettingsHydrationNotice hydration={hydration} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] xl:items-start">
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Theme presets</CardTitle>
              <CardDescription>
                Storefront palettes only — the public website stays light. Admin light/dark is
                separate (header toggle).
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {appearancePresets.map((preset) => {
                const isActive = activePresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectPreset(preset.id)}
                    aria-pressed={isActive}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-premium",
                      isActive
                        ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-primary/40"
                    )}
                  >
                    <div className="mb-3 flex gap-1">
                      {preset.swatches.map((color) => (
                        <span
                          key={color}
                          className="size-5 rounded-full border border-border"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{preset.name}</p>
                      {isActive ? <Check className="size-4 shrink-0 text-primary" /> : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <CardTitle className="text-base">Brand colors</CardTitle>
                  <CardDescription>
                    Fine-tune primary, accent, and cream surfaces for the light storefront.
                  </CardDescription>
                </div>
                <Badge variant={activePresetId === "custom" ? "warning" : "outline"}>
                  {activePresetId === "custom" ? "Custom" : activePreset?.name ?? "Custom"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {COLOR_FIELDS.map((field) => {
                const valid =
                  settings[field.key] === "" || isValidHexColor(settings[field.key]);
                return (
                  <div key={field.key} className="space-y-2">
                    <Label htmlFor={field.key}>{field.label}</Label>
                    <div className="flex gap-2">
                      <Input
                        id={field.key}
                        type="color"
                        value={
                          isValidHexColor(settings[field.key])
                            ? normalizeHexColor(settings[field.key])
                            : "#000000"
                        }
                        onChange={(e) => updateColor(field.key, e.target.value)}
                        className="h-10 w-14 shrink-0 cursor-pointer px-1 py-1"
                        aria-label={`${field.label} color picker`}
                      />
                      <Input
                        value={settings[field.key]}
                        onChange={(e) => updateColor(field.key, e.target.value)}
                        className="min-w-0 font-mono text-xs uppercase"
                        aria-label={`${field.label} hex value`}
                        aria-invalid={!valid}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-xs",
                        valid ? "text-muted-foreground" : "text-destructive"
                      )}
                    >
                      {valid ? field.hint : "Enter a hex color like #6f4e37"}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Shape &amp; typography</CardTitle>
              <CardDescription>
                Border radius applies to the storefront. Typography uses Plus Jakarta Sans +
                Inter.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="border-radius">Border radius</Label>
                <AdminSelect
                  id="border-radius"
                  value={String(settings.borderRadius)}
                  onChange={(e) =>
                    updateBorderRadius(
                      Number(e.target.value) as AppearanceSettings["borderRadius"]
                    )
                  }
                >
                  <option value="12">12px — default cards &amp; buttons</option>
                  <option value="16">16px — softer large surfaces</option>
                </AdminSelect>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Heading
                  </p>
                  <p className="mt-2 font-heading text-2xl font-bold">Celebration Cakes</p>
                  <p className="mt-1 text-xs text-muted-foreground">Plus Jakarta Sans</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                    Body
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Freshly baked cakes, pastries, and confections made with premium
                    ingredients.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Inter</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <AppearancePreview
            settings={settings}
            isDirty={isDirty}
            hydration={hydration}
            saved={saved}
          />
        </div>
      </div>
    </SettingsSectionShell>
  );
}
