"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Lock, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The Razorpay credentials form.
 *
 * Extracted so it can live in BOTH places an admin looks for it: the Payments
 * screen, and the Razorpay entry under Payment Gateways. The gateway page used
 * to render a notice pointing at the other screen — which is a redirect served
 * to someone who had already navigated to exactly the right place. The two
 * screens were only ever separate because Razorpay's keys lived on the server
 * while every other gateway's lived in the browser, and that difference is gone.
 */

export interface RazorpayStatus {
  configured: boolean;
  keyId: string;
  source: "env" | "admin" | null;
  envLocked: boolean;
  testMode: boolean | null;
  webhookConfigured: boolean;
  webhookEnvLocked: boolean;
  /** Whether Razorpay ANSWERED. Null when not checked. */
  verified: boolean | null;
  verifyError: string | null;
}

export function RazorpayKeysForm({ onStatusChange }: { onStatusChange?: (s: RazorpayStatus) => void }) {
  const [status, setStatus] = useState<RazorpayStatus | null>(null);
  const [keyId, setKeyId] = useState("");
  const [keySecret, setKeySecret] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const apply = useCallback(
    (next: RazorpayStatus) => {
      setStatus(next);
      setKeyId(next.keyId || "");
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  useEffect(() => {
    let cancelled = false;
    // `verify=1`: ask Razorpay whether the keys work, not just whether they are
    // present. A `.env.local` holding the literal placeholder
    // `rzp_test_xxxxxxxxxxxxxx` used to show a green "Connected" badge.
    fetch("/api/razorpay/config?verify=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((next: RazorpayStatus | null) => {
        if (!cancelled && next) apply(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apply]);

  async function recheck() {
    setChecking(true);
    try {
      const res = await fetch("/api/razorpay/config?verify=1");
      if (res.ok) apply((await res.json()) as RazorpayStatus);
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setChecking(false);
    }
  }

  async function save() {
    const id = keyId.trim();
    const secret = keySecret.trim();
    const hook = webhookSecret.trim();

    // "Are the KEYS being changed?" — not "is there text in the key box". That
    // box is pre-filled with the live key, so a plain `id || secret` was true for
    // every configured shop and saving the webhook secret alone always failed
    // the both-required check below.
    const changingKeys = Boolean(secret) || id !== (status?.keyId ?? "");

    if (changingKeys && !(id && secret)) {
      toast.error("Enter both Key ID and Key Secret");
      return;
    }
    if (!changingKeys && !hook) {
      toast.error("Nothing to save");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/razorpay/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Only what changed. A blank field leaves the stored value alone, so
        // rotating the key id cannot wipe the webhook secret beside it.
        body: JSON.stringify({
          ...(changingKeys ? { keyId: id, keySecret: secret } : {}),
          ...(hook ? { webhookSecret: hook } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not save");
        return;
      }
      setKeySecret("");
      setWebhookSecret("");
      // Re-verify rather than trust: new keys are exactly when "do they work?"
      // is worth asking, and the answer is what the badge will claim.
      await recheck();
      toast.success(changingKeys ? "Keys saved" : "Webhook secret saved");
    } catch {
      toast.error("Could not reach the server");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    try {
      const res = await fetch("/api/razorpay/config", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not disconnect");
        return;
      }
      apply(data as RazorpayStatus);
      setKeySecret("");
      setWebhookSecret("");
      toast.success("Razorpay disconnected");
    } catch {
      toast.error("Could not reach the server");
    }
  }


  // No Card wrapper, no status badge of its own.
  //
  // Both used to be here, and the page that hosts this renders its own — so the
  // Razorpay screen showed a card inside a card, two headers, and the connection
  // state twice. This is the fields; the page is the frame.

  return (
    <div className="space-y-4">
      {status?.verified === false ? (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            {/* One sentence, not two. The headline said "Razorpay did not accept
                these keys" and `verifyError` immediately said "Razorpay rejected
                these keys. Check the Key ID and Key Secret." — the same fact,
                twice, stacked. */}
            <p className="text-muted-foreground">
              <span className="font-medium text-destructive">
                {status.verifyError ?? "Razorpay refused these credentials."}
              </span>{" "}
              Online payments will fail at checkout until this is fixed.
              {/* The two together are the confusing case: rejected keys, and a
                  form you cannot type into. Say where the real ones go. */}
              {status.envLocked ? (
                <>
                  {" "}
                  The keys in use come from <code>.env.local</code> — the fix is in that file, not
                  on this screen.
                </>
              ) : null}
            </p>
          </div>
        ) : null}

        {/*
          Says WHICH variables and BOTH ways out.

          It used to say only "edit that file and restart the server" — which
          leaves someone staring at two disabled inputs with no idea what to type
          where, and no hint that the lock is optional. Naming the variables and
          the unlock path is the difference between a locked form and a dead end.
        */}
        {status?.envLocked ? (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <div className="space-y-2">
              <p>
                These two fields are locked because the keys come from{" "}
                <code>.env.local</code>. Environment variables win over anything saved here, so
                letting you type would save a value that never gets used.
              </p>
              <p>
                <span className="font-medium text-foreground">To change the keys:</span> edit{" "}
                <code>RAZORPAY_KEY_ID</code> and <code>RAZORPAY_KEY_SECRET</code> in that file, then
                restart the server.
              </p>
              <p>
                <span className="font-medium text-foreground">To manage them here instead:</span>{" "}
                remove those two lines and restart — the fields unlock and keys are stored on the
                server.
              </p>
              <p>The webhook secret below is separate and can always be set here.</p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rzpKeyId">Key ID</Label>
            <Input
              id="rzpKeyId"
              // "Not set" rather than a fake key. The old placeholder was
              // `rzp_test_xxxxxxxxxxxx`, which in a DISABLED input is visually
              // identical to a real key rendered in the same grey — so there was
              // no way to tell a configured field from an empty one. A
              // placeholder must never look like a value.
              placeholder="Not set"
              value={keyId}
              onChange={(e) => setKeyId(e.target.value)}
              disabled={status?.envLocked}
              autoComplete="off"
            />
            {status?.configured && status.keyId ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                In use: <code>{status.keyId}</code>
                {status.source === "env" ? " (from .env.local)" : ""}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="rzpKeySecret">Key Secret</Label>
            <Input
              id="rzpKeySecret"
              type="password"
              placeholder={status?.configured ? "Saved — type to replace" : "Not set"}
              value={keySecret}
              onChange={(e) => setKeySecret(e.target.value)}
              disabled={status?.envLocked}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Razorpay shows this once, when the key is generated. It is never shown again — here or
              there.
            </p>
          </div>
        </div>

        {/*
          The webhook secret. There was nowhere to enter it: the field existed in
          the gateway registry but was never rendered, and the save endpoint
          discarded it — so `getRazorpayWebhookSecret()` always returned null and
          the webhook 503'd every delivery. That webhook is the only thing that
          turns a captured payment into an order when the customer's browser dies
          mid-checkout, so it was inert exactly when it mattered.

          Independent of `envLocked`: a shop whose API keys come from the
          environment still has to be able to set this, because there is no other
          route to it.
        */}
        <div className="space-y-2">
          <Label htmlFor="rzpWebhookSecret">Webhook secret</Label>
          <Input
            id="rzpWebhookSecret"
            type="password"
            placeholder={
              status?.webhookConfigured
                ? "Saved — type to replace"
                : "Not set — paste the secret from your Razorpay webhook"
            }
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            disabled={status?.webhookEnvLocked}
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground">
            {status?.webhookEnvLocked
              ? "Set via RAZORPAY_WEBHOOK_SECRET in your environment file."
              : status?.webhookConfigured
                ? "Set. A payment still becomes an order if the customer closes the tab, and refunds settle on their own."
                : "Not set. Without it, a payment whose customer closed the tab never becomes an order, and refunds stay stuck at “processing”. Add the webhook in Razorpay → Settings → Webhooks pointing at /api/razorpay/webhook, and paste its secret here."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="bakery"
            onClick={save}
            disabled={saving || (status?.envLocked && status?.webhookEnvLocked)}
          >
            {saving ? "Saving…" : status?.configured ? "Update keys" : "Save & Connect"}
          </Button>
          {status?.configured ? (
            <Button variant="outline" onClick={recheck} disabled={checking}>
              {checking ? "Testing…" : "Test connection"}
            </Button>
          ) : null}
          {status?.configured && !status.envLocked ? (
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Get keys from{" "}
          <a
            href="https://dashboard.razorpay.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-bakery-700 hover:underline"
          >
            dashboard.razorpay.com
          </a>{" "}
          → Account &amp; Settings → API Keys. Use <code>rzp_test_</code> keys for testing. Your
          secret is stored on the server and never sent back to this browser.
        </p>
    </div>
  );
}
