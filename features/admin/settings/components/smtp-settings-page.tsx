"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    const loaded = getSmtpSettings();
    setSettings(loaded);
    setSavedSettings(loaded);
    setMounted(true);
  }, []);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const hostSet = Boolean(settings.host.trim());
  const encryptionLabel =
    settings.encryption === "none" ? "None" : settings.encryption.toUpperCase();

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
          ? `${settings.enabled ? "Enabled" : "Disabled"} · ${encryptionLabel}${hostSet ? ` · ${settings.host}` : ""}`
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
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={settings.password}
              onChange={(e) => setSettings((prev) => ({ ...prev, password: e.target.value }))}
              placeholder="••••••••"
            />
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
