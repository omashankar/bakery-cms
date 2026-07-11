"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { formatRelativeTime } from "@/utils/format";
import { getDashboardActivities, type DashboardActivityItem } from "../lib/dashboard-data";

export function DashboardActivityFeed() {
  const [activities, setActivities] = useState<DashboardActivityItem[]>([]);

  useEffect(() => {
    setActivities(getDashboardActivities().slice(0, 5));
  }, []);

  return (
    <Card className="shadow-sm">
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
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity yet.</p>
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
