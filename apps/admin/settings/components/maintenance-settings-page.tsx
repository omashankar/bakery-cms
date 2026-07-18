"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MaintenanceSettings } from "@/types/settings";
import { defaultMaintenanceSettings } from "@/features/settings/lib/settings-utils";
import {
  getMaintenanceSettings,
  resetMaintenanceSettings,
  saveMaintenanceSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

export function MaintenanceSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<MaintenanceSettings>(defaultMaintenanceSettings);
  const [savedSettings, setSavedSettings] = useState<MaintenanceSettings>(
    defaultMaintenanceSettings
  );
  const [allowedIpsInput, setAllowedIpsInput] = useState("");

  useEffect(() => {
    const loaded = getMaintenanceSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setAllowedIpsInput(loaded.allowedIps.join(", "));
    setMounted(true);
  }, []);

  const isDirty =
    JSON.stringify(settings) !== JSON.stringify(savedSettings) ||
    allowedIpsInput !== savedSettings.allowedIps.join(", ");

  const allowedIpCount = allowedIpsInput
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean).length;

  // The banner and status line describe the LIVE storefront, so they must read the
  // saved value — the unsaved toggle hasn't taken the store down (or brought it back) yet.
  const liveEnabled = savedSettings.isEnabled;
  const togglePending = settings.isEnabled !== savedSettings.isEnabled;

  function handleSave() {
    const allowedIps = allowedIpsInput
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean);
    const payload = { ...settings, allowedIps };
    const saved = saveMaintenanceSettings(payload);
    setSavedSettings(saved);
    setSettings(saved);
    setAllowedIpsInput(saved.allowedIps.join(", "));
    toast.success(
      saved.isEnabled ? "Maintenance mode enabled" : "Maintenance settings saved"
    );
  }

  function handleDiscard() {
    setSettings(savedSettings);
    setAllowedIpsInput(savedSettings.allowedIps.join(", "));
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetMaintenanceSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setAllowedIpsInput(loaded.allowedIps.join(", "));
    toast.success("Maintenance settings reset to defaults");
  }

  return (
    <SettingsSectionShell
      title="Maintenance"
      description={
        mounted
          ? `${liveEnabled ? "Enabled" : "Disabled"} · ${allowedIpCount} allowed IP${allowedIpCount === 1 ? "" : "s"}`
          : "Show a maintenance notice on the public storefront while you make updates."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
    >
      {liveEnabled ? (
        <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Maintenance mode is active</p>
            <p className="text-sm text-amber-800 dark:text-amber-200/90">
              Visitors see the maintenance banner on the storefront. Allowed IPs can still
              browse normally in a future backend integration.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Storefront status</CardTitle>
            <CardDescription>Toggle maintenance mode for the public website.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="maintenance-enabled" className="text-sm">
              Enabled
            </Label>
            <Switch
              id="maintenance-enabled"
              checked={settings.isEnabled}
              onCheckedChange={(checked) =>
                setSettings((prev) => ({ ...prev, isEnabled: checked }))
              }
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {togglePending ? (
            <p className="text-xs text-muted-foreground">
              {settings.isEnabled
                ? "Not applied yet — save changes to take the storefront offline."
                : "Not applied yet — save changes to bring the storefront back online."}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="message">Visitor message</Label>
            <textarea
              id="message"
              className={adminTextareaClassName}
              value={settings.message}
              onChange={(e) => setSettings((prev) => ({ ...prev, message: e.target.value }))}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowedIps">Allowed IPs (comma-separated)</Label>
            <Input
              id="allowedIps"
              value={allowedIpsInput}
              onChange={(e) => setAllowedIpsInput(e.target.value)}
              placeholder="127.0.0.1, 192.168.1.10"
            />
          </div>
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
