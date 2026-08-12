"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { formatRelativeTime } from "@/utils/format";
import type { ActivityLog } from "@/types/settings";
import { clearActivityLog, getActivityLog } from "@/features/settings/lib/settings-repository";
import { fetchAuditLogs } from "@/features/audit/lib/audit-api";
import { auditToActivity, mergeActivity } from "@/features/audit/lib/audit-activity";
import { ListLoading } from "@/components/shared/list-loading";

const actionTone: Record<string, string> = {
  published: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  updated: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  created: "bg-muted text-foreground",
  enabled: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  disabled: "bg-muted text-muted-foreground",
  cleared: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  received: "bg-secondary text-secondary-foreground",
};

export function ActivitySettingsPage() {
  const [mounted, setMounted] = useState(false);
  // Kept apart, because only ONE of them can be cleared.
  //
  // Both were merged into a single `entries` list, and the confirm dialog then
  // counted it: "permanently removes all 137 logged actions ... cannot be
  // undone", where 100 of the 137 were server AUDIT rows that Clear does not
  // touch and that reappear on the next load. Clearing also dropped them from
  // the list, so the screen agreed with the lie until someone reloaded.
  const [localEntries, setLocalEntries] = useState<ActivityLog[]>([]);
  const [serverEntries, setServerEntries] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    setLocalEntries(getActivityLog());
    setMounted(true);
  }, []);

  // Hydrate the durable server audit trail (every admin/customer action, across
  // devices) into the same list, merged with the local settings activity.
  /**
   * The AUDIT read's own state.
   *
   * The empty sentence below was gated on `mounted`, which the local-storage
   * effect above sets — a different request entirely. So the panel said "No
   * activity recorded yet" over a populated audit collection for the whole
   * round trip, and permanently on a 401 or a 500. That is the log an owner
   * opens to find out who changed something.
   */
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditFailed, setAuditFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchAuditLogs({ limit: 100 });
      if (cancelled) return;
      if (result) setServerEntries(result.items.map(auditToActivity));
      setAuditFailed(!result);
      setAuditLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo(
    () => mergeActivity(serverEntries, localEntries),
    [serverEntries, localEntries]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (entry) =>
        entry.action.toLowerCase().includes(query) ||
        entry.entity.toLowerCase().includes(query) ||
        entry.userId.toLowerCase().includes(query) ||
        entry.details?.toLowerCase().includes(query)
    );
  }, [entries, search]);

  async function confirmClear() {
    const { value, persisted } = await clearActivityLog();
    // Only the local slice moves. The server audit rows stay on screen because
    // they stay in the database — they used to disappear here and come back on
    // reload, which made a partial clear look like a complete one.
    setLocalEntries(value);
    setClearOpen(false);

    if (!persisted) {
      toast.error("Cleared on this device only — the server rejected it", {
        description: "Reload to see the server’s version.",
      });
      return;
    }

    toast.success(
      serverEntries.length > 0
        ? "This browser's activity cleared — the server audit trail is unchanged"
        : "Activity log cleared"
    );
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Activity Log"
        description="Recent actions across settings, content, and inquiries in this demo CMS."
        actions={
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => setClearOpen(true)}
            disabled={!mounted || entries.length === 0}
          >
            Clear log
          </Button>
        }
      />

      {!mounted ? (
        <div className="min-h-64 animate-pulse rounded-xl border border-border bg-muted" />
      ) : (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Search activity</CardTitle>
            <CardDescription>Filter by action, entity, user, or details.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity..."
              aria-label="Search activity"
            />
            <div className="divide-y divide-border rounded-xl border border-border">
              {auditLoading ? (
                <ListLoading rows={5} label="Loading the activity log" />
              ) : auditFailed && entries.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Could not load the activity log — the server did not answer.
                </p>
              ) : filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  {/*
                    Two different nothings. The seeded demo rows meant this
                    panel was never empty on a fresh shop, so the only copy
                    written for it assumed a search — and once those
                    fabricated rows were removed, a brand-new shop opened its
                    activity log and read "No matching activity" with an
                    empty search box, which reads like a broken filter
                    rather than a log with nothing in it yet.
                  */}
                  {entries.length === 0
                    ? "No activity recorded yet — actions you take in the admin will appear here."
                    : "No matching activity."}
                </p>
              ) : (
                filtered.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-start justify-between gap-3 p-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={actionTone[entry.action] ?? "bg-muted text-foreground"}>
                          {entry.action}
                        </Badge>
                        <span className="text-sm font-medium capitalize">{entry.entity}</span>
                        {entry.entityId ? (
                          <span className="text-xs text-muted-foreground">#{entry.entityId}</span>
                        ) : null}
                      </div>
                      {entry.details ? (
                        <p className="text-sm text-muted-foreground">{entry.details}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatRelativeTime(entry.timestamp)}</p>
                      <p>{entry.userId}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clear activity log?</DialogTitle>
            <DialogDescription>
              This removes the {localEntries.length} settings action
              {localEntries.length === 1 ? "" : "s"} recorded in this browser, and cannot be
              undone.
              {serverEntries.length > 0 ? (
                <>
                  {" "}
                  The {serverEntries.length} entries from the server audit trail are NOT removed —
                  that is a permanent record of who changed what, and it stays.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClear}>
              Clear log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
