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
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { formatRelativeTime } from "@/utils/format";
import type { ActivityLog } from "@/types/settings";
import { clearActivityLog, getActivityLog } from "../lib/settings-repository";

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
  const [entries, setEntries] = useState<ActivityLog[]>([]);
  const [search, setSearch] = useState("");
  const [clearOpen, setClearOpen] = useState(false);

  useEffect(() => {
    setEntries(getActivityLog());
    setMounted(true);
  }, []);

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

  function confirmClear() {
    const cleared = clearActivityLog();
    setEntries(cleared);
    setClearOpen(false);
    toast.success("Activity log cleared");
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
              {filtered.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  No matching activity.
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
              This permanently removes all {entries.length} logged actions from this browser. This
              cannot be undone.
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
