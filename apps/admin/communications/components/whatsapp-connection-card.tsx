"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, PlugZap, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchWhatsAppConnection,
  saveWhatsAppConnectionRequest,
  syncWhatsAppTemplatesRequest,
  verifyWhatsAppRequest,
} from "@/apps/admin/communications/lib/communications-api";
import {
  SettingsFormGate,
  SettingsHydrationNotice,
} from "@/apps/admin/settings/components/settings-field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MetaSyncSummary, WhatsAppConnectionStatus } from "@/types/whatsapp-provider";
import { reportedAsSignedOut } from "@/apps/admin/lib/report-write";

/**
 * Connecting the shop's WhatsApp Business number.
 *
 * The screen this sits on used to say "Connect a WhatsApp Business / BSP
 * provider in production" — an instruction with nowhere to carry it out. This
 * is that place.
 *
 * The access token is write-only by design: it is sent up, never read back, and
 * the form shows only whether one is stored. `readWhatsAppConnectionStatus`
 * enforces that server-side; this component could not display the token if it
 * wanted to.
 */

interface WhatsAppConnectionCardProps {
  /**
   * Called after a sync with what Meta reported.
   *
   * The summary carries the real template list, which is what turns the Meta
   * name field from a text box into a picker — and a sync also rewrites
   * `approval` on the stored rows, so the page needs to reload them.
   */
  onSynced?: (summary: MetaSyncSummary | null) => void;
  /**
   * Reports the stored connection up, so the page header can describe the
   * same state this card shows. Two independent reads is how a header ends
   * up insisting sending is not connected while this card reads Connected.
   */
  onStatus?: (status: {
    configured: boolean;
    enabled: boolean;
    displayName?: string;
  }) => void;
}

const EMPTY_FORM = {
  phoneNumberId: "",
  businessAccountId: "",
  accessToken: "",
  enabled: false,
};

export function WhatsAppConnectionCard({ onSynced, onStatus }: WhatsAppConnectionCardProps) {
  const [status, setStatus] = useState<WhatsAppConnectionStatus | null>(null);
  // Tri-state, like every other form on this screen: "unavailable" still
  // RENDERS — fields visible, saving refused — because a boolean here blanks
  // the card permanently whenever the read fails.
  const [hydration, setHydration] = useState<"pending" | "ready" | "unavailable">("pending");
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState<"save" | "verify" | "sync" | null>(null);
  const [account, setAccount] = useState<string | null>(null);

  /**
   * Held in a ref so the load effect can stay a one-shot.
   *
   * Putting the callback in the dependency array makes this card re-fetch the
   * connection every time the parent re-renders with a new function identity —
   * a request per keystroke in the editor above it. Leaving it OUT is what the
   * exhaustive-deps rule warns about, and the warning is right: a parent that
   * swapped the callback would keep being called through the old one.
   */
  const onStatusRef = useRef(onStatus);
  // Assigned in an effect rather than during render: a ref write during render
  // is not safe under concurrent rendering, which is what the lint rule is
  // guarding. This runs after every commit, so the ref is never stale.
  useEffect(() => {
    onStatusRef.current = onStatus;
  });

  useEffect(() => {
    let cancelled = false;

    void fetchWhatsAppConnection().then((loaded) => {
      if (cancelled) return;
      if (!loaded) {
        setHydration("unavailable");
        return;
      }
      setStatus(loaded);
      onStatusRef.current?.({ configured: loaded.configured, enabled: loaded.enabled });
      setForm({
        phoneNumberId: loaded.phoneNumberId,
        businessAccountId: loaded.businessAccountId,
        // Never populated from the server — there is nothing to populate it
        // with. Blank means "keep the stored token" all the way through.
        accessToken: "",
        enabled: loaded.enabled,
      });
      setHydration("ready");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (hydration !== "ready" || busy) return;

    setBusy("save");
    const accepted = await saveWhatsAppConnectionRequest(form);
    if (accepted) {
      const refreshed = await fetchWhatsAppConnection();
      if (refreshed) {
        setStatus(refreshed);
        onStatus?.({ configured: refreshed.configured, enabled: refreshed.enabled });
      }
      // Cleared so the field never holds a secret longer than the request that
      // carried it, and so the next save keeps what was just stored.
      setForm((current) => ({ ...current, accessToken: "" }));
    }
    setBusy(null);

    if (accepted) toast.success("WhatsApp connection saved");
    else if (!reportedAsSignedOut()) toast.error("The server refused the connection", { description: "Nothing was saved." });
  }

  async function handleVerify() {
    if (busy) return;
    setBusy("verify");
    const result = await verifyWhatsAppRequest();
    setBusy(null);

    if (!result.ok) {
      setAccount(null);
      toast.error("Could not reach WhatsApp", { description: result.error });
      return;
    }

    const name = [result.data?.verifiedName, result.data?.displayPhoneNumber]
      .filter(Boolean)
      .join(" · ");
    setAccount(name || "Connected");
    // The verified name is the friendliest thing the header can say, and only
    // a live check knows it.
    onStatus?.({
      configured: true,
      enabled: status?.enabled ?? false,
      displayName: result.data?.verifiedName || undefined,
    });
    toast.success("WhatsApp connected", { description: name || undefined });
  }

  async function handleSync() {
    if (busy) return;
    setBusy("sync");
    const result = await syncWhatsAppTemplatesRequest();
    setBusy(null);

    if (!result.ok) {
      toast.error("Could not sync with Meta", { description: result.error });
      return;
    }

    const summary = result.data;
    const approved = summary?.matched.filter((row) => row.approval === "approved").length ?? 0;
    const missing = summary?.missing.length ?? 0;

    onSynced?.(summary);
    toast.success(`Synced with Meta — ${approved} approved`, {
      description: missing
        ? `${missing} template${missing === 1 ? "" : "s"} point at a name Meta no longer has.`
        : `${summary?.available.length ?? 0} template${summary?.available.length === 1 ? "" : "s"} on your account.`,
    });
  }

  const connected = status?.configured ?? false;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <PlugZap className="h-4 w-4" />
          WhatsApp Business connection
        </CardTitle>
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {status?.enabled ? "Connected" : "Connected · sending off"}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not connected
          </span>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          From Meta&apos;s WhatsApp Business Cloud API. Create a System User token with the{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">whatsapp_business_messaging</code>{" "}
          permission in Meta Business Settings, then paste the ids from the API Setup page.
        </p>

        <SettingsHydrationNotice hydration={hydration} />

        <SettingsFormGate hydration={hydration}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="wa-phone-number-id">Phone number id</Label>
              <Input
                id="wa-phone-number-id"
                value={form.phoneNumberId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phoneNumberId: event.target.value }))
                }
                placeholder="123456789012345"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wa-business-account-id">WhatsApp Business Account id</Label>
              <Input
                id="wa-business-account-id"
                value={form.businessAccountId}
                onChange={(event) =>
                  setForm((current) => ({ ...current, businessAccountId: event.target.value }))
                }
                placeholder="098765432109876"
              />
              <p className="text-xs text-muted-foreground">
                Needed to read which templates Meta has approved.
              </p>
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="wa-access-token">Access token</Label>
              <Input
                id="wa-access-token"
                type="password"
                autoComplete="off"
                value={form.accessToken}
                onChange={(event) =>
                  setForm((current) => ({ ...current, accessToken: event.target.value }))
                }
                placeholder={status?.tokenSet ? "Stored — leave blank to keep it" : "EAAG…"}
              />
              <p className="text-xs text-muted-foreground">
                {status?.tokenSet
                  ? "A token is stored. It is never shown again — leave this blank unless you are replacing it."
                  : "Stored on the server only, and never sent back to this page."}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2 sm:col-span-2">
              <div>
                <p className="text-sm font-medium">Send WhatsApp messages</p>
                <p className="text-xs text-muted-foreground">
                  Off means templates stay drafts and nothing is sent, without clearing the token.
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, enabled: checked }))
                }
              />
            </div>
          </div>
        </SettingsFormGate>

        {account ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">Verified as {account}.</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button variant="bakery" onClick={handleSave} disabled={hydration !== "ready" || Boolean(busy)}>
            {busy === "save" ? "Saving…" : "Save connection"}
          </Button>
          {/*
            Both of these need the SAVED credentials, so they are useless until
            something is stored — and offering them beforehand would produce a
            "not connected" error that reads like a failure rather than a step
            not yet taken.
          */}
          <Button variant="outline" onClick={handleVerify} disabled={!connected || Boolean(busy)}>
            {busy === "verify" ? "Checking…" : "Test connection"}
          </Button>
          <Button variant="outline" onClick={handleSync} disabled={!connected || Boolean(busy)}>
            <RefreshCw className={`mr-2 h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
            {busy === "sync" ? "Syncing…" : "Sync with Meta"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
