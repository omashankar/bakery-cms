"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  getGeneralSettings,
  getModuleSettings,
  resetModuleSettings,
  saveModuleSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

type ModuleKey = keyof ModuleSettings;

const PRODUCT_MODULES: Array<{ key: ModuleKey; title: string; description: string }> = [
  {
    key: "flavour",
    title: "Flavour",
    description: "Flavour selector and flavour options on products.",
  },
  {
    key: "eggEggless",
    title: "Egg / Eggless",
    description: "Egg or eggless choice on products.",
  },
  {
    key: "weight",
    title: "Weight",
    description: "Weight variants and per-weight pricing.",
  },
  {
    key: "shape",
    title: "Shape",
    description: "Available shapes for the product.",
  },
  {
    key: "photoCake",
    title: "Photo Cake",
    description: "Photo upload / personalised photo option.",
  },
];

export function ModulesSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<ModuleSettings>(defaultModuleSettings);
  const [savedSettings, setSavedSettings] = useState<ModuleSettings>(defaultModuleSettings);
  const [isBakery, setIsBakery] = useState(true);

  useEffect(() => {
    const loaded = getModuleSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setIsBakery(getGeneralSettings().businessType === "bakery");
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const enabledCount = Object.values(settings).filter(Boolean).length;

  function toggle(key: ModuleKey, checked: boolean) {
    setSettings((prev) => ({ ...prev, [key]: checked }));
  }

  function handleSave() {
    const saved = saveModuleSettings(settings);
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("Modules saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetModuleSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("Modules reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Modules"
      description={
        mounted
          ? `${enabledCount} of ${PRODUCT_MODULES.length + 1} modules enabled`
          : "Turn optional bakery features on or off. Disabled modules hide from the UI only."
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
            <CardTitle className="text-base">Product options</CardTitle>
            <CardDescription>
              Bakery-specific product fields. Turn off for businesses that don&apos;t need them —
              fields are only hidden, never deleted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {PRODUCT_MODULES.map((mod) => (
              <ModuleSwitch
                key={mod.key}
                title={mod.title}
                description={mod.description}
                checked={settings[mod.key]}
                onCheckedChange={(checked) => toggle(mod.key, checked)}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Builders</CardTitle>
            <CardDescription>Optional website builders for bakery-specific pages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ModuleSwitch
              title="Wedding Builder"
              description="Wedding cakes page, builder, and storefront link."
              checked={settings.weddingBuilder}
              onCheckedChange={(checked) => toggle("weddingBuilder", checked)}
            />
            {mounted && !isBakery ? (
              <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
                Business type is not <span className="font-medium">Bakery</span>, so the Wedding
                Builder and Wedding Cakes link are already hidden from the storefront and sidebar
                regardless of this toggle.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </SettingsSectionShell>
  );
}

function ModuleSwitch({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} />
    </div>
  );
}
