"use client";

import { useState } from "react";
import { CheckCircle2, MailSearch, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RelativeTime } from "@/components/shared/relative-time";
import { fetchDeliveryCheck } from "@/features/settings/lib/settings-api";
import type { DeliveryCheck, DnsCheck } from "@/lib/server/mail/delivery-check";
import { cn } from "@/lib/utils";

function Row({ label, check }: { label: string; check: DnsCheck }) {
  const Icon = check.ok ? CheckCircle2 : XCircle;
  return (
    <li className="flex gap-2.5 py-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", check.ok ? "text-green-600" : "text-amber-600")} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">{check.note}</p>
        {check.record ? <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{check.record}</p> : null}
      </div>
    </li>
  );
}

/** Brevo's own word for what happened to a message, in plain words. */
const EVENT_WORDS: Record<string, string> = {
  requests: "Accepted",
  delivered: "Delivered",
  opened: "Opened",
  clicks: "Clicked",
  hardBounces: "Bounced (address does not exist)",
  softBounces: "Bounced (try again later)",
  blocked: "Blocked by Brevo",
  spam: "Marked as spam",
  invalid: "Invalid address",
  deferred: "Delayed by the receiving server",
  unsubscribed: "Unsubscribed",
  error: "Error",
};

/**
 * Is mail actually reaching inboxes? The provider accepting a message is not
 * delivery — the shop's provider said "queued" to every invitation while
 * nothing arrived. This shows the sending domain's DNS and, for Brevo with a
 * key on the server, Brevo's own account, sender and delivery log.
 */
export function MailDeliveryCheck() {
  const [report, setReport] = useState<DeliveryCheck | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setError("");
    const result = await fetchDeliveryCheck();
    setBusy(false);
    if (result.ok) setReport(result.data);
    else setError(result.error);
  }

  const brevo = report?.brevo;
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base">Is mail reaching inboxes?</CardTitle>
          <CardDescription>
            Your mail server accepting a message is not the same as it arriving. This checks your sending
            domain&rsquo;s settings and, for Brevo, what Brevo did with your recent messages.
          </CardDescription>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void run()} disabled={busy}>
          <MailSearch className="size-4" aria-hidden />
          {busy ? "Checking…" : "Check delivery"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        {!report ? (
          <p className="text-sm text-muted-foreground">Press Check delivery to look.</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Sending domain {report.domain ? `— ${report.domain}` : ""}
              </p>
              <ul className="divide-y divide-border">
                <Row label="DKIM (proves the mail is really from you)" check={report.dkim} />
                <Row label="DMARC (tells inboxes what to do with fakes)" check={report.dmarc} />
                <Row label="SPF (which servers may send for you)" check={report.spf} />
              </ul>
            </div>

            {brevo ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brevo</p>
                {brevo.error ? (
                  <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">{brevo.error}</p>
                ) : (
                  <>
                    <ul className="divide-y divide-border">
                      <Row
                        label="Account"
                        check={{
                          ok: true,
                          record: "",
                          note: `${brevo.account?.email ?? ""}${brevo.account?.plan ? ` · plan ${brevo.account.plan}` : ""}${
                            brevo.account?.credits !== null && brevo.account?.credits !== undefined ? ` · ${brevo.account.credits} credits` : ""
                          }`,
                        }}
                      />
                      <Row
                        label={`Sender ${report.fromEmail}`}
                        check={
                          brevo.sender?.verified
                            ? { ok: true, record: "", note: "Verified in Brevo." }
                            : {
                                ok: false,
                                record: "",
                                note: brevo.sender
                                  ? "Added but NOT verified — Brevo → Senders, Domains & Dedicated IPs → verify it."
                                  : "Not a sender in this Brevo account — add and verify it under Senders, Domains & Dedicated IPs.",
                              }
                        }
                      />
                      <Row
                        label={`Domain ${report.domain}`}
                        check={
                          brevo.domain?.authenticated
                            ? { ok: true, record: "", note: "Authenticated in Brevo." }
                            : {
                                ok: false,
                                record: "",
                                note: brevo.domain
                                  ? "Added but NOT authenticated — Brevo → Senders, Domains → Authenticate this domain."
                                  : "Not in this Brevo account — add it under Senders, Domains & Dedicated IPs → Domains.",
                              }
                        }
                      />
                    </ul>
                    <div>
                      <p className="mb-1 text-sm font-medium text-foreground">Recent messages (last 7 days)</p>
                      {brevo.events && brevo.events.length > 0 ? (
                        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                          {brevo.events.map((e, i) => (
                            <li key={`${e.date}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
                              <span className="min-w-0 truncate">
                                <span className="font-medium">{EVENT_WORDS[e.event] ?? e.event}</span> · {e.email}
                                {e.reason ? <span className="text-muted-foreground"> — {e.reason}</span> : null}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {e.date ? <RelativeTime date={e.date} /> : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">Brevo has no messages from the last 7 days.</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
