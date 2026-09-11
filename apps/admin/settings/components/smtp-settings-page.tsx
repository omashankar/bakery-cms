"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { sendTestEmailRequest } from "@/features/settings/lib/settings-api";
import {
  reportSettingsReset,
  reportSettingsWrite,
} from "@/apps/admin/settings/lib/report-settings-write";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { SmtpSettings } from "@/types/settings";
import { defaultSmtpSettings } from "@/features/settings/lib/settings-utils";
import {
  getSmtpSettings,
  resetSmtpSettings,
  saveSmtpSettings,
} from "@/features/settings/lib/settings-repository";
import { SettingsSectionShell } from "./settings-section-shell";
import { SettingsHydrationNotice } from "./settings-field-error";
import { useSettingsSection } from "@/features/settings/lib/use-settings-section";

export function SmtpSettingsPage() {
  // The shared section form. This page hand-rolled it and never resynced: a
  // one-shot `[]`-dep effect read localStorage on mount, with no
  // SETTINGS_UPDATED_EVENT listener at all, so the form was stuck on whatever
  // that read returned for the whole page session. `SettingsServerSync` reads
  // the real copy from a root-layout effect, so on a hard load that read is
  // still in flight and the local store answers with the DEMO SEED — and Save
  // PUT the seed over the real section, which is a whole-section replace.
  //
  // This section is the shop's mail server: host, port, username, PASSWORD,
  // from-address and the enabled switch. What lands is the demo seed with the
  // password BLANK and `enabled: false`, and the mail transport short-circuits
  // on `!enabled` — so every password reset, order confirmation and refund
  // email stops, silently, while the admin is told "SMTP settings saved". The
  // password is the unrecoverable part: it is write-only in this form, so it
  // has to be fetched from the mail provider again.
  const { settings, saved, isDirty, hydration, isWriting, canSave, edit, discard, runWrite } =
    useSettingsSection<SmtpSettings>(getSmtpSettings, defaultSmtpSettings);
  const [testing, setTesting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // The header status line describes what outbound email actually does, so it reads the
  // saved values — an unsaved toggle hasn't changed live behaviour yet.
  const hostSet = Boolean(saved.host.trim());
  const encryptionLabel =
    saved.encryption === "none" ? "None" : saved.encryption.toUpperCase();

  /**
   * A password accepted by the server, before the next hydration confirms it.
   *
   * `saved.passwordSet` is only refreshed by a full read, so the hint under the
   * field kept saying "No password saved" beside the toast that had just said
   * the opposite. Reset clears it again, because a reset removes the password.
   */
  const [justSavedPassword, setJustSavedPassword] = useState(false);

  async function handleSave() {
    if (!canSave) return;
    const sendingPassword = Boolean(settings.password?.trim());
    await runWrite(async () => {
      const { value, persisted } = await saveSmtpSettings(settings);
      if (persisted && sendingPassword) setJustSavedPassword(true);
      // Only mark clean when the SERVER has it — the dirty flag is what keeps
      // the Save button enabled, and greying it out would remove the only retry.
      return { value, accepted: reportSettingsWrite(persisted, "SMTP settings") };
    });
  }

  function handleDiscard() {
    discard();
    toast.message("Discarded unsaved changes");
  }

  async function handleReset() {
    if (!canSave) return;
    await runWrite(async () => {
      const { value, persisted } = await resetSmtpSettings();
      if (persisted) setJustSavedPassword(false);
      return { value, accepted: reportSettingsReset(persisted, "SMTP settings") };
    });
  }

  /**
   * Sends a REAL test email through the saved settings.
   *
   * The server reads what is stored, not what is on screen, so unsaved edits are
   * not what gets tested — say so rather than test the wrong thing silently.
   */
  async function handleTestEmail() {
    if (isDirty) {
      toast.error("Save your changes first", {
        description: "The test uses the saved settings, not the ones on screen.",
      });
      return;
    }
    if (!saved.enabled) {
      toast.error("Enable SMTP before sending a test email");
      return;
    }

    setTesting(true);
    const result = await sendTestEmailRequest();
    setTesting(false);

    if (!result.sent) {
      toast.error("Test email failed", { description: result.error });
      return;
    }

    toast.success("Test email sent", {
      description: "Check the inbox of the account you are signed in as.",
    });
  }

  return (
    <SettingsSectionShell
      title="SMTP"
      description="The email account your shop sends order confirmations and sign-in codes from."
      status={
        hydration === "ready"
          ? `${saved.enabled ? "Enabled" : "Disabled"} · ${encryptionLabel}${hostSet ? ` · ${saved.host}` : ""}`
          : undefined
      }
      isDirty={isDirty}
      // Behind the skeleton until the SERVER's copy has landed. Gating only
      // the Save button leaves the gap open.
      mounted={hydration !== "pending"}
      isSaving={isWriting}
      saveDisabled={!canSave}
      onSave={handleSave}
      onDiscard={handleDiscard}
      onReset={handleReset}
      // Reset sits outside the gated form, so without this it is clickable
      // before hydration and its handler simply returns.
      resetDisabled={!canSave}
      extraActions={
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => void handleTestEmail()}
          // Gated like Reset. The handler checks `saved.enabled`, and before
          // hydration that is the shipped default — so on a hard load the
          // admin was told "Enable SMTP before sending a test" about a shop
          // whose SMTP is enabled.
          disabled={testing || hydration !== "ready"}
        >
          {testing ? "Sending…" : "Send test email"}
        </Button>
      }
    >
      <SettingsHydrationNotice hydration={hydration} />
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Mail server</CardTitle>
            {/*
              BOTH SENTENCES WERE FALSE, on the screen most likely to be left
              half-filled because of them.

              These values are PUT to the server and kept in the database; the
              password is stored server-side and redacted on read, which the
              hint under that very field says out loud. And "Send test email"
              sends a real message. A shop reading "demo purposes" has every
              reason to stop here — and then no order confirmation, no sign-in
              code and no password reset ever leaves.
            */}
            <CardDescription>
              The email account your shop sends from. Order confirmations, sign-in
              codes and password resets all go out through it. Get these details
              from whoever provides your email.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="smtp-enabled" className="text-sm">
              Enabled
            </Label>
            <Switch
              id="smtp-enabled"
              checked={settings.enabled}
              onCheckedChange={(checked) => edit((prev) => ({ ...prev, enabled: checked }))}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="host">SMTP host</Label>
            <Input
              id="host"
              value={settings.host}
              onChange={(e) => edit((prev) => ({ ...prev, host: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              From your email provider. It usually starts with smtp.
            </p>
          </div>
          {/*
            PORT AND ENCRYPTION ARE ONE DECISION, and they were the two cells
            furthest apart on the card — Port second, Encryption last, across a
            full-width row at the bottom. They only make sense as a pair: 587
            with TLS, or 465 with SSL. Split up, a shop pairs 587 with SSL and
            the send fails with a timeout that names neither.
          */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  type="number"
                  value={settings.port}
                  onChange={(e) =>
                    edit((prev) => ({ ...prev, port: Number(e.target.value) || 587 }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="encryption">Encryption</Label>
                <AdminSelect
                  id="encryption"
                  value={settings.encryption}
                  onChange={(e) =>
                    edit((prev) => ({
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
            </div>
            <p className="text-xs text-muted-foreground">
              These two go together. Port 587 with TLS, or port 465 with SSL.
              Your provider&rsquo;s help page says which.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={settings.username}
              onChange={(e) => edit((prev) => ({ ...prev, username: e.target.value }))}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Usually the full email address of the account.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={settings.password}
                onChange={(e) => edit((prev) => ({ ...prev, password: e.target.value }))}
                // Write-only now. The server redacts it on read, so this box is
                // empty unless the admin is typing a new one — and sending an
                // empty one back means "keep the stored password".
                placeholder={saved.passwordSet ? "Saved — leave blank to keep it" : "••••••••"}
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
            <p className="text-xs text-muted-foreground">
              {/*
                `passwordSet` only ever came from a full hydration read, so
                after a successful save of a NEW password this line still read
                "No password saved" — directly beside the success toast that had
                just said otherwise. `justSavedPassword` covers the gap until
                the next read confirms it.
              */}
              {saved.passwordSet || justSavedPassword
                ? "A password is saved on the server. Leave this blank to keep it, or type a new one to replace it."
                : "No password saved. An internal relay on a trusted network may not need one."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromEmail">From email</Label>
            <Input
              id="fromEmail"
              type="email"
              value={settings.fromEmail}
              onChange={(e) => edit((prev) => ({ ...prev, fromEmail: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              What a customer sees the mail came from. Most providers refuse to
              send unless this matches the account above.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fromName">From name</Label>
            <Input
              id="fromName"
              value={settings.fromName}
              onChange={(e) => edit((prev) => ({ ...prev, fromName: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              The name beside that address in the customer&rsquo;s inbox — your shop&rsquo;s.
            </p>
          </div>
        </CardContent>
      </Card>
    </SettingsSectionShell>
  );
}
