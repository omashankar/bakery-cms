"use client";

import { useState } from "react";
import { Bug, CheckCircle2, Globe, RefreshCw, Server } from "lucide-react";
import { toast } from "sonner";

import { AdminPage, AdminPageHeader } from "@/apps/admin/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { RelativeTime } from "@/components/shared/relative-time";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";
import type { ErrorLogView } from "@/features/error-log/lib/error-log-types";
import { useCan } from "@/features/team/lib/access-context";
import { cn } from "@/lib/utils";

/** Plain words for where it happened. */
const WHERE: Record<string, string> = {
  page: "Page",
  api: "Server request",
  action: "Form action",
  proxy: "Routing",
  browser: "Customer's browser",
};

async function readLog(): Promise<ErrorLogView[] | null> {
  try {
    const res = await fetch("/api/errors", { cache: "no-store" });
    if (!res.ok) {
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as { data?: ErrorLogView[] };
    return json.data ?? [];
  } catch {
    return null;
  }
}

/**
 * What went wrong on the site, newest first — so a broken checkout or a page
 * that crashes for customers is something the shop can SEE, not something it
 * learns about from a lost order. Grouped: one row per kind of failure, with
 * how many times it happened.
 */
export function ErrorLogPage({ initial = null }: { initial?: ErrorLogView[] | null }) {
  const [entries, setEntries] = useState<ErrorLogView[] | null>(initial);
  const [view, setView] = useState<"open" | "fixed">("open");
  const [busy, setBusy] = useState(false);
  const canManage = useCan("security.manage");

  async function refresh() {
    setBusy(true);
    const next = await readLog();
    setBusy(false);
    if (next) setEntries(next);
    else toast.error("Couldn't load the error log. Try again.");
  }

  async function markFixed(entry: ErrorLogView) {
    try {
      const res = await fetch(`/api/errors/${encodeURIComponent(entry.id)}`, { method: "PATCH" });
      noteAuthStatus(res.status);
      if (!res.ok) throw new Error();
      setEntries((list) => (list ?? []).map((e) => (e.id === entry.id ? { ...e, resolvedAt: new Date().toISOString() } : e)));
      toast.success("Marked as fixed", { description: "If it happens again it comes back to this list." });
    } catch {
      toast.error("Couldn't mark it fixed. Try again.");
    }
  }

  const all = entries ?? [];
  const open = all.filter((e) => !e.resolvedAt);
  const fixed = all.filter((e) => e.resolvedAt);
  const shown = view === "open" ? open : fixed;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Error log"
        description="Problems the site ran into — on the server, or in a customer's browser. Kept for 30 days after they last happen."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={busy}>
            <RefreshCw className={cn("size-4", busy && "animate-spin")} aria-hidden />
            Refresh
          </Button>
        }
      />

      <div className="inline-flex rounded-lg bg-muted p-[3px] text-sm" role="tablist" aria-label="Which errors">
        {(
          [
            ["open", `Open (${open.length})`],
            ["fixed", `Fixed (${fixed.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={view === key}
            onClick={() => setView(key)}
            className={cn(
              "min-h-8 rounded-md px-3 font-medium text-muted-foreground transition-colors",
              view === key && "bg-card text-foreground shadow-sm",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {entries === null ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          The error log could not be loaded. Press Refresh.
        </p>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={view === "open" ? CheckCircle2 : Bug}
          title={view === "open" ? "Nothing has gone wrong" : "Nothing marked fixed yet"}
          description={
            view === "open"
              ? "When a page, a payment or a customer's browser runs into a problem, it shows up here."
              : "Errors you mark as fixed move here, and come back if they happen again."
          }
        />
      ) : (
        <ul className="space-y-3">
          {shown.map((entry) => {
            const Icon = entry.source === "browser" ? Globe : Server;
            return (
              <li key={entry.id} className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={entry.source === "browser" ? "warning" : "destructive"}>
                        <Icon className="size-3" aria-hidden />
                        {WHERE[entry.kind] ?? entry.kind}
                      </Badge>
                      <Badge variant="outline">× {entry.count}</Badge>
                    </div>
                    <p className="break-words font-medium text-foreground">{entry.message}</p>
                    {entry.path ? (
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {entry.method ? `${entry.method} ` : ""}
                        {entry.path}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Last <RelativeTime date={entry.lastSeenAt} /> · first <RelativeTime date={entry.firstSeenAt} />
                      {entry.resolvedAt ? (
                        <>
                          {" "}
                          · fixed <RelativeTime date={entry.resolvedAt} />
                        </>
                      ) : null}
                    </p>
                  </div>
                  {canManage && !entry.resolvedAt ? (
                    <Button size="sm" variant="outline" onClick={() => void markFixed(entry)}>
                      <CheckCircle2 className="size-4" aria-hidden />
                      Mark fixed
                    </Button>
                  ) : null}
                </div>
                {entry.stack || entry.digest ? (
                  <details className="mt-3 rounded-lg bg-muted/60 p-3 text-xs">
                    <summary className="cursor-pointer font-medium text-muted-foreground">Technical details</summary>
                    {entry.digest ? <p className="mt-2 font-mono">Digest: {entry.digest}</p> : null}
                    {entry.stack ? (
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed">
                        {entry.stack}
                      </pre>
                    ) : null}
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </AdminPage>
  );
}
