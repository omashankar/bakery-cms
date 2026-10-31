"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, ChevronRight, MessageSquare, Package } from "lucide-react";
import { syncNotifications } from "@/apps/admin/commerce/lib/notifications-repository";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { cn } from "@/lib/utils";
import { useAccess } from "@/features/team/lib/access-context";
import { canOpenRoute } from "@/features/team/lib/route-access";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { getDashboardAlerts, type DashboardAlert } from "../lib/dashboard-analytics";
import { subscribeToAdminData } from "@/apps/admin/lib/admin-data-events";
import { whenHydrated } from "@/lib/hydrate-once";

const iconMap = {
  "inventory-out": Package,
  "inventory-low": AlertTriangle,
  "inquiries-new": MessageSquare,
  "notifications-unread": Bell,
} as const;

const toneStyles = {
  warning: adminShell.alertWarning,
  destructive: adminShell.alertDestructive,
  neutral: "border-border bg-card text-foreground",
};

/** If a source never arrives, show what there is rather than nothing for good. */
const SETTLE_DEADLINE_MS = 8000;

export function DashboardAlertsStrip() {
  const [allAlerts, setAlerts] = useState<DashboardAlert[]>([]);
  const labels = useBusinessLabels();
  // An alert is a link; only the ones that lead somewhere this member can go.
  const { can, canAny } = useAccess();
  const alerts = allAlerts.filter((alert) => canOpenRoute(alert.href, can));

  /**
   * Counted only once the caches it counts from hold the SERVER's data.
   *
   * Before that they hold the browser's seed: the strip counted the demo
   * products' stock, showed an alert, then counted the real ones and took it
   * away, and again as each cache landed — the dashboard jumped 140px down,
   * up and down again a few seconds after it had painted (CLS 0.21 on a
   * throttled phone). One appearance, from real figures.
   */
  const sources = [
    canAny(["products.view", "inventory.view"]) ? "products" : null,
    can("orders.view") ? "orders" : null,
    can("inquiries.view") ? "inquiries" : null,
  ]
    .filter(Boolean)
    .join(",");
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const keys = sources ? sources.split(",") : [];
    const deadline = setTimeout(() => !cancelled && setSettled(true), SETTLE_DEADLINE_MS);
    void Promise.all(keys.map(whenHydrated)).then(() => {
      if (!cancelled) setSettled(true);
    });
    return () => {
      cancelled = true;
      clearTimeout(deadline);
    };
  }, [sources]);

  useEffect(() => {
    if (!settled) return;
    function refresh() {
      syncNotifications();
      setAlerts(getDashboardAlerts(labels));
    }

    refresh();
    return subscribeToAdminData(refresh);
    // `labels` here too, or the strip keeps the wording from first paint.
  }, [labels, settled]);

  if (!settled || alerts.length === 0) return null;

  return (
    <section
      className={cn(
        // One row on a phone, scrolling sideways: a stack of four would push
        // the whole dashboard down the screen when it arrives.
        "flex gap-2 overflow-x-auto pb-0.5 sm:grid sm:overflow-visible sm:pb-0 [&>*]:min-w-[13rem] [&>*]:shrink-0 sm:[&>*]:min-w-0",
        alerts.length === 1 && "sm:grid-cols-1",
        alerts.length === 2 && "sm:grid-cols-2",
        alerts.length >= 3 && "sm:grid-cols-2 xl:grid-cols-4"
      )}
    >
      {alerts.map((alert) => {
        const Icon = iconMap[alert.id as keyof typeof iconMap] ?? AlertTriangle;
        return (
          <Link
            key={alert.id}
            href={alert.href}
            className={cn(
              "group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-premium hover:shadow-sm sm:gap-3 sm:px-3.5",
              toneStyles[alert.tone]
            )}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/70">
              <Icon className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{alert.label}</p>
              <p className="truncate text-xs opacity-75">{alert.value}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
          </Link>
        );
      })}
    </section>
  );
}
