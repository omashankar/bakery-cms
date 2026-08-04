"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Info } from "lucide-react";

import { reportWrite } from "@/apps/admin/lib/report-write";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaymentGatewayConfig } from "@/features/payments/registry/gateways";
import {
  fetchGatewayCredentialStatus,
  saveGatewayCredentials,
  type GatewayCredentialStatus,
} from "@/features/payments/lib/payment-gateway-settings";

/**
 * The credentials form EVERY gateway gets, driven by the registry.
 *
 * This is the answer to "what happens when we switch the other gateways on".
 * Adding one should not mean adding a screen: the fields come from that
 * gateway's `configFields`, the values go to the shared server-side store
 * (`POST /api/payments/gateways/[id]/credentials`), and nothing here knows or
 * cares which gateway it is rendering.
 *
 * So wiring up, say, Stripe is three steps and none of them are in this file:
 *   1. implement its payment path on the server (the actual work),
 *   2. add its method to `registry/methods.ts` so checkout can render it,
 *   3. flip `isCore: true` in `registry/gateways.ts`.
 * This form, the enable switch, the credentials API and the "available now"
 * section all start working for it at that point.
 *
 * Razorpay is the one exception, and deliberately: it predates this, keeps its
 * keys in environment variables as well as the database, has a webhook secret,
 * and can be verified against the live gateway. Those do not generalise, so it
 * has its own form rather than bending this one out of shape.
 */
export function GatewayCredentialsForm({ config }: { config: PaymentGatewayConfig }) {
  // Only what the admin types in this session. Stored values are never sent
  // back — the server answers WHICH fields it holds, never what is in them.
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<GatewayCredentialStatus | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchGatewayCredentialStatus(config.id).then((next) => {
      if (!cancelled) setStatus(next);
    });
    return () => {
      cancelled = true;
    };
  }, [config.id]);

  async function save() {
    const filled = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim()),
    );
    if (Object.keys(filled).length === 0) {
      reportWrite(false, "Nothing to save");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveGatewayCredentials(config.id, filled);
      reportWrite(saved, `${config.name} credentials saved`);
      if (saved) {
        // Keeping secrets in React state after a successful save has no purpose
        // and every downside.
        setValues({});
        setStatus(await fetchGatewayCredentialStatus(config.id));
      }
    } finally {
      setSaving(false);
    }
  }

  if (config.configFields.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted p-4 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>Nothing to configure — this method needs no credentials.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {config.configFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label htmlFor={`${config.id}-${field.key}`}>
              {field.label}
              {field.required ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Input
              id={`${config.id}-${field.key}`}
              type={field.type}
              // Never a placeholder that could pass for a value: a saved secret
              // and an empty box render identically otherwise.
              placeholder={
                status?.filledFields.includes(field.key) ? "Saved — type to replace" : "Not set"
              }
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
              autoComplete="off"
            />
            {field.helper ? (
              <p className="text-xs text-muted-foreground">{field.helper}</p>
            ) : null}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="bakery" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save credentials"}
        </Button>
        {config.docsUrl ? (
          <Button
            variant="ghost"
            render={<a href={config.docsUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <ExternalLink className="size-4" />
            Get keys
          </Button>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        Credentials are stored on the server and never sent back to this browser. A blank field
        leaves the saved value alone, so editing one does not wipe the others.
      </p>
    </div>
  );
}
