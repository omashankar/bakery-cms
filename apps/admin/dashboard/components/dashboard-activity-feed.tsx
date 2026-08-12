"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PanelLoading } from "@/components/shared/panel-loading";
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/utils/format";
import { fetchAuditLogs } from "@/features/audit/lib/audit-api";
import { auditToActivity } from "@/features/audit/lib/audit-activity";
import {
  formatActivityEntry,
  getDashboardActivities,
  type DashboardActivityItem,
} from "../lib/dashboard-data";

const FEED_LIMIT = 5;

export function DashboardActivityFeed() {
  const [activities, setActivities] = useState<DashboardActivityItem[]>([]);
  /**
   * Whether the first effect has run.
   *
   * The read below is synchronous, but `useEffect` fires after the browser
   * paints — so without this there is a real frame stating the shop has none of
   * these. It cannot be read eagerly instead: this renders on the server too,
   * where the browser-held store is empty, and seeding from it would be a
   * hydration mismatch.
   */
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Show the local log first so the card is never blank while the request is
    // in flight, then replace it with the server's durable trail. The local log
    // only records what this browser did; the audit trail spans every device.
    setActivities(getDashboardActivities().slice(0, FEED_LIMIT));
    setLoaded(true);

    (async () => {
      const result = await fetchAuditLogs({ limit: FEED_LIMIT });
      if (cancelled || !result) return;
      setActivities(result.items.map((entry) => formatActivityEntry(auditToActivity(entry))));
    })();

    return () => {
      cancelled = true;
    };
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
                  <p className="mt-0.5 text-[11px] capitalize text-muted-foreground">
                    {activity.entity} · {formatRelativeTime(activity.timestamp)}
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
