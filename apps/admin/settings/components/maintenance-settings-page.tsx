"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { adminTextareaClassName } from "@/apps/admin/products/components/admin-field";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { MaintenanceSettings } from "@/types/settings";
import { defaultMaintenanceSettings } from "@/features/settings/lib/settings-utils";
import { isValidIp, parseAllowedIps } from "@/features/settings/lib/maintenance-access";
import {
  getMaintenanceSettings,
  resetMaintenanceSettings,
  saveMaintenanceSettings,
} from "@/features/settings/lib/settings-repository";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";
import { SettingsSectionShell } from "./settings-section-shell";
import { FieldError, SettingsHydrationNotice } from "./settings-field-error";

/** Everything the server will reject, checked here first. */
function validate(settings: MaintenanceSettings) {
  const invalid = settings.allowedIps.filter((ip) => !isValidIp(ip));
  return {
    message: settings.message.trim()
      ? ""
      : "Visitors see this on the closed store, so it cannot be empty.",
    allowedIps: invalid.length
      ? `Not valid IP addresses: ${invalid.join(", ")}. These decide who can still reach the closed store, so an entry that never matches is access an admin thinks they have.`
      : "",
  };
}

interface MaintenanceSettingsPageProps {
  /**
   * Whether the server can identify a visitor's address at all. False unless the
   * deployment sets `TRUST_PROXY_HEADERS=true`, because `x-forwarded-for` is
   * written by the CLIENT otherwise — believing it would let anyone walk past a
   * closed shop with one header.
   */
  ipAllowListWorks?: boolean;
}

export function MaintenanceSettingsPage({
  ipAllowListWorks = false,
}: MaintenanceSettingsPageProps) {
  const router = useRouter();
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<MaintenanceSettings>(getMaintenanceSettings, defaultMaintenanceSettings);

  // The raw text of the IP field, kept separate so a half-typed address does not
  // vanish while the admin is still typing the rest of it.
  const [ipDraft, setIpDraft] = useState<string | null>(null);
  const ipText = ipDraft ?? settings.allowedIps.join(", ");

  const errors = validate(settings);
  const hasErrors = Object.values(errors).some(Boolean);

  // The banner and the status line describe the LIVE storefront, so they read
  // the saved value — an unsaved toggle has not closed anything yet.
  const liveEnabled = saved.isEnabled;
  const togglePending = settings.isEnabled !== saved.isEnabled;

  function commitIps(text: string) {
    setIpDraft(text);
    edit((prev) => ({ ...prev, allowedIps: parseAllowedIps(text) }));
  }

  async function handleSave() {
    if (hasErrors || !canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await saveMaintenanceSettings(settings);
      // Maintenance mode is read from the SERVER copy, so a rejected write
      // leaves the storefront exactly as it was — open when the admin thinks
      // they closed it.
      const subject = value.isEnabled ? "Maintenance mode" : "Maintenance settings";
      const accepted = reportSettingsWrite(persisted, subject);
      // Dropped either way: `runWrite` replaces `settings` regardless of the
      // outcome, so keeping the draft would leave the field showing text that no
      // longer matches the addresses the next Save would send.
      setIpDraft(null);
      if (accepted) {
        // The storefront gate is decided on the server, and the admin's own
        // pages render through it — re-render so the change is visible now.
        router.refresh();
      }
      return { value, accepted };
    });
  }

  function handleDiscard() {
    discard();
    setIpDraft(null);
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetMaintenanceSettings();
      const accepted = reportSettingsReset(persisted, "Maintenance settings");
      setIpDraft(null);
      if (accepted) router.refresh();
      return { value, accepted };
    });
  }

  // From `saved`, like `liveEnabled` beside it. This read the unsaved DRAFT,
  // so the header said "Store closed · 3 allowed IPs" — a statement about the
  // live storefront — while two of those three had been typed and not saved,
  // and could not reach anybody.
  const allowedIpCount = saved.allowedIps.length;

  return (
    <SettingsSectionShell
      title="Maintenance"
      description={
        hydration === "ready"
          ? `${liveEnabled ? "Store closed" : "Store open"} · ${allowedIpCount} allowed IP${allowedIpCount === 1 ? "" : "s"}`
          : "Close the public storefront while you make updates."
      }
      isDirty={isDirty}
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={hasErrors || !canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
    >
      <SettingsHydrationNotice hydration={hydration} />

      {liveEnabled ? (
        <div className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50 p-4 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">The storefront is closed</p>
            <p className="text-sm text-amber-800 dark:text-amber-200/90">
              Visitors see your notice instead of the shop, and checkout is refused. You and any
              allowed IP can still browse normally.
            </p>
          </div>
        </div>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Storefront status</CardTitle>
            <CardDescription>Close the public website while you make updates.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="maintenance-enabled" className="text-sm">
              Closed
            </Label>
            <Switch
              id="maintenance-enabled"
              checked={settings.isEnabled}
              onCheckedChange={(checked) => edit((prev) => ({ ...prev, isEnabled: checked }))}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {togglePending ? (
            <p className="text-xs text-muted-foreground">
              {settings.isEnabled
                ? "Not applied yet — save changes to close the storefront."
                : "Not applied yet — save changes to reopen the storefront."}
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="message">Visitor message</Label>
            <textarea
              id="message"
              className={cn(adminTextareaClassName, errors.message && "border-destructive")}
              value={settings.message}
              aria-invalid={Boolean(errors.message)}
              aria-describedby={errors.message ? "message-error" : undefined}
              onChange={(e) => edit((prev) => ({ ...prev, message: e.target.value }))}
              rows={4}
            />
            <FieldError id="message-error" message={errors.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowedIps">Allowed IPs (comma-separated)</Label>
            <Input
              id="allowedIps"
              value={ipText}
              aria-invalid={Boolean(errors.allowedIps)}
              aria-describedby={errors.allowedIps ? "allowedIps-error" : undefined}
              className={cn(errors.allowedIps && "border-destructive")}
              onChange={(e) => commitIps(e.target.value)}
              placeholder="127.0.0.1, 192.168.1.10"
            />
            <FieldError id="allowedIps-error" message={errors.allowedIps} />
            {ipAllowListWorks ? (
              <p className="text-xs text-muted-foreground">
                These addresses can still reach the store while it is closed. Signing in to the
                admin also lets you through, so you do not need your own IP here.
              </p>
            ) : (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                This list is not in effect. The server cannot tell where a visitor is connecting
                from unless it is behind a proxy it trusts — set{" "}
                <code className="font-mono">TRUST_PROXY_HEADERS=true</code> once that is true.
                Until then, sign in to the admin to reach a closed store.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
