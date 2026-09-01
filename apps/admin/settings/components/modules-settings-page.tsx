"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ModuleSettings } from "@/types/settings";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  getModuleSettings,
  resetModuleSettings,
  saveModuleSettings,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { SettingsSectionShell } from "./settings-section-shell";
import { SettingsHydrationNotice } from "./settings-field-error";

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

/**
 * Every switch on this page, in one list — the count in the header is derived
 * from it rather than from `Object.values(settings)`, which would silently drift
 * the moment the stored object carries a key this page does not render.
 */
const MODULE_KEYS: ModuleKey[] = [
  ...PRODUCT_MODULES.map((mod) => mod.key),
  "weddingBuilder",
];

export function ModulesSettingsPage() {
  const router = useRouter();
  const { settings, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<ModuleSettings>(getModuleSettings, defaultModuleSettings);

  const enabledCount = MODULE_KEYS.filter((key) => settings[key]).length;

  function toggle(key: ModuleKey, checked: boolean) {
    edit((prev) => ({ ...prev, [key]: checked }));
  }

  async function handleSave() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveModuleSettings(settings);
      // Modules decide which admin sections and storefront pages exist at all,
      // and that is read from the server copy — a local-only change shows
      // nobody else.
      const accepted = reportSettingsWrite(persisted, "Modules");
      // The wedding page and builder are closed by the SERVER when the module
      // is off, so the routes have to be re-rendered for the change to take.
      if (accepted) router.refresh();
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
      const { value, persisted } = await resetModuleSettings();
      const accepted = reportSettingsReset(persisted, "Modules");
      if (accepted) router.refresh();
      return { value, accepted };
    });
  }

  return (
    <SettingsSectionShell
      title="Modules"
      description={
        hydration === "ready"
          ? `${enabledCount} of ${MODULE_KEYS.length} modules enabled`
          : "Turn optional bakery features on or off. Disabled modules hide from the UI only."
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed: flipping a
      // switch on the seed makes the form dirty, the resync then skips it to
      // protect that edit, and Save pushes all-six-on over the shop's real
      // module state — which decides what exists on the storefront.
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
            {/*
              A note used to sit here explaining that the business type had
              already hidden the Wedding Builder "regardless of this toggle" —
              i.e. telling the admin that the switch in front of them decided
              nothing. It is now the only thing that decides it.
            */}
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
