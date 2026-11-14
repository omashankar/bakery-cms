"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PanelLoading } from "@/components/shared/panel-loading";
import { routes } from "@/constants/routes";
import { fetchAuditLogs } from "@/features/audit/lib/audit-api";
import { auditToActivity } from "@/features/audit/lib/audit-activity";
import type { AuditLogEntry } from "@/types/audit";
import { DASHBOARD_FEED_LIMIT } from "../lib/dashboard-defaults";
import {
  formatActivityEntry,
  getDashboardActivities,
  type DashboardActivityItem,
} from "../lib/dashboard-data";
import { RelativeTime } from "@/components/shared/relative-time";
import { useExternalValue, windowEvents } from "@/hooks/use-external-value";
import { useHydrated } from "@/hooks/use-hydrated";

const otherTabChanges = windowEvents("storage");
const NO_ACTIVITY: DashboardActivityItem[] = [];
const readLocalFeed = () => getDashboardActivities().slice(0, DASHBOARD_FEED_LIMIT);

export function DashboardActivityFeed({
  initial = null,
}: {
  /** The audit trail's newest entries, read on the server; null fetches as before. */
  initial?: AuditLogEntry[] | null;
} = {}) {
  // The server's durable trail: with the page, or once it answers.
  const [serverFeed, setServerFeed] = useState<DashboardActivityItem[] | null>(() =>
    initial ? initial.map((entry) => formatActivityEntry(auditToActivity(entry))) : null,
  );
  /*
    Until it answers, this browser's own log — so the card is never blank
    while the request is in flight. It only records what this browser did;
    the audit trail spans every device, and replaces it when it lands.

    Not on the server or in the hydrating render: there the browser-held log
    is empty, and drawing from it would be a hydration mismatch. `loaded` says
    whether there is anything to state yet, so no frame claims "none".
  */
  const hydrated = useHydrated();
  const localFeed = useExternalValue(readLocalFeed, otherTabChanges, NO_ACTIVITY);
  const activities = serverFeed ?? (hydrated ? localFeed : NO_ACTIVITY);
  const loaded = Boolean(initial) || hydrated;

  useEffect(() => {
    // The server already read the durable trail for this page.
    if (initial) return;
    let cancelled = false;
    void fetchAuditLogs({ limit: DASHBOARD_FEED_LIMIT }).then((result) => {
      if (cancelled || !result) return;
      setServerFeed(result.items.map((entry) => formatActivityEntry(auditToActivity(entry))));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load
  }, []);

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="size-4 text-gold-600 dark:text-gold-300" />
            Activity
          </CardTitle>
          <CardDescription>Recent admin changes</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          render={<Link href={routes.admin.settings.activity} />}
        >
          Log
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        {!loaded ? (
          <PanelLoading label="Loading recent activity" rows={5} />
        ) : activities.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No recent activity yet.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {activities.map((activity) => (
              <li key={activity.id} className="flex items-start gap-2.5">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-foreground">{activity.message}</p>
                  {/* "4m ago" is computed from the clock, which moves between the
                      server's render and hydration. */}
                  <p
                    className="mt-0.5 text-[11px] capitalize text-muted-foreground"
                    suppressHydrationWarning
                  >
                    {activity.entity} · <RelativeTime date={activity.timestamp} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
