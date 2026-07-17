"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { AppearanceSettings } from "@/types/appearance";
import { SettingsSectionShell } from "@/features/admin/settings/components/settings-section-shell";
import {
  loadAppearanceSettings,
  resetAppearanceSettings,
  saveAppearanceSettings,
} from "../lib/appearance-repository";
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
} from "../lib/appearance-utils";
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
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<AppearanceSettings>(defaultAppearanceSettings);
  const [savedSettings, setSavedSettings] =
    useState<AppearanceSettings>(defaultAppearanceSettings);

  useEffect(() => {
    const loaded = loadAppearanceSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!hasValidAppearanceColors(settings)) return;
    applyAppearanceSettings(settings);
    return () => {
      applyAppearanceSettings(loadAppearanceSettings());
    };
  }, [settings, mounted]);

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings]
  );

  const overview = useMemo(
    () => (mounted ? getAppearanceOverview(settings) : EMPTY_OVERVIEW),
    [mounted, settings]
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

  function handleSave() {
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

    const saved = saveAppearanceSettings(normalized);
    setSettings(saved);
    setSavedSettings(saved);
    toast.success("Appearance saved — storefront uses these colors (light only)");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const reset = resetAppearanceSettings();
    setSettings(reset);
    setSavedSettings(reset);
    toast.success("Appearance reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Appearance"
      description={
        mounted
          ? `Storefront brand (light only) · ${overview.presetLabel} · ${overview.borderRadius}px radius · ${overview.isCustom ? "custom colors" : "preset palette"}`
          : "Storefront brand colors and shape — light mode only, never dark"
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      saveDisabled={!hasValidAppearanceColors(settings)}
      resetTitle="Reset appearance?"
      resetDescription="Restore the Monginis Classic preset and default radius. Custom colors will be lost."
    >
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
          <AppearancePreview settings={settings} isDirty={isDirty} />
        </div>
      </div>
    </SettingsSectionShell>
  );
}
