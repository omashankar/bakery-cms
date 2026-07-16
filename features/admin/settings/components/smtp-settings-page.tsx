"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AdminSelect } from "@/features/admin/cakes/components/admin-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SmtpSettings } from "@/types/settings";
import { defaultSmtpSettings } from "../lib/settings-utils";
import {
  getSmtpSettings,
  resetSmtpSettings,
  saveSmtpSettings,
} from "../lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";

export function SmtpSettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [settings, setSettings] = useState<SmtpSettings>(defaultSmtpSettings);
  const [savedSettings, setSavedSettings] = useState<SmtpSettings>(defaultSmtpSettings);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const loaded = getSmtpSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);

  // The header status line describes what outbound email actually does, so it reads the
  // saved values — an unsaved toggle hasn't changed live behaviour yet.
  const hostSet = Boolean(savedSettings.host.trim());
  const encryptionLabel =
    savedSettings.encryption === "none" ? "None" : savedSettings.encryption.toUpperCase();

  function handleSave() {
    const saved = saveSmtpSettings(settings);
    setSavedSettings(saved);
    setSettings(saved);
    toast.success("SMTP settings saved");
  }

  function handleDiscard() {
    setSettings(savedSettings);
    toast.message("Discarded unsaved changes");
  }

  function handleReset() {
    const loaded = resetSmtpSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    toast.success("SMTP settings reset to defaults");
  }

  function handleTestEmail() {
    if (!settings.enabled) {
      toast.error("Enable SMTP before sending a test email");
      return;
    }
    toast.success("Test email queued (demo — no backend connected)");
  }

  return (
    <SettingsSectionShell
      title="SMTP"
      description={
        mounted
          ? `${savedSettings.enabled ? "Enabled" : "Disabled"} · ${encryptionLabel}${hostSet ? ` · ${savedSettings.host}` : ""}`
          : "Configure outbound email for inquiry notifications and newsletters."
      }
      isDirty={isDirty}
      mounted={mounted}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      extraActions={
        <Button variant="outline" className="w-full sm:w-auto" onClick={handleTestEmail}>
          Send test email
        </Button>
      }
    >
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Mail server</CardTitle>
            <CardDescription>
              Stored locally for demo purposes. Connect a real provider in production.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="smtp-enabled" className="text-sm">
              Enabled
            </Label>
            <Switch
              id="smtp-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="host">SMTP host</Label>
            <Input
              id="host"
              value={settings.host}
              onChange={(e) => setSettings((prev) => ({ ...prev, host: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              type="number"
              value={settings.port}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, port: Number(e.target.value) || 587 }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={settings.username}
              onChange={(e) => setSettings((prev) => ({ ...prev, username: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={settings.password}
                onChange={(e) => setSettings((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="••••••••"
                // new-password is the reliable signal that stops the browser autofilling
                // the admin's own saved login password into the SMTP field.
                autoComplete="new-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromEmail">From email</Label>
            <Input
              id="fromEmail"
              type="email"
              value={settings.fromEmail}
              onChange={(e) => setSettings((prev) => ({ ...prev, fromEmail: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromName">From name</Label>
            <Input
              id="fromName"
              value={settings.fromName}
              onChange={(e) => setSettings((prev) => ({ ...prev, fromName: e.target.value }))}
            />
          </div>
          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="encryption">Encryption</Label>
            <AdminSelect
              id="encryption"
              value={settings.encryption}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  encryption: e.target.value as SmtpSettings["encryption"],
                }))
              }
            >
              <option value="tls">TLS</option>
              <option value="ssl">SSL</option>
              <option value="none">None</option>
            </AdminSelect>
          </div>
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
