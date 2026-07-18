"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Bell, ChevronRight, MessageSquare, Package } from "lucide-react";
import { INVENTORY_UPDATED_EVENT } from "@/apps/admin/commerce/lib/inventory-repository";
import {
  NOTIFICATIONS_UPDATED_EVENT,
  syncNotifications,
} from "@/apps/admin/commerce/lib/notifications-repository";
import { INQUIRIES_UPDATED_EVENT } from "@/features/inquiries/lib/inquiries-repository";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { cn } from "@/lib/utils";
import { getDashboardAlerts, type DashboardAlert } from "../lib/dashboard-analytics";

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

export function DashboardAlertsStrip() {
  const [alerts, setAlerts] = useState<DashboardAlert[]>([]);

  useEffect(() => {
    function refresh() {
      syncNotifications();
      setAlerts(getDashboardAlerts());
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    window.addEventListener(INVENTORY_UPDATED_EVENT, refresh);
    window.addEventListener(INQUIRIES_UPDATED_EVENT, refresh);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);

    return () => {
      window.removeEventListener("bakery-orders-updated", refresh);
      window.removeEventListener(INVENTORY_UPDATED_EVENT, refresh);
      window.removeEventListener(INQUIRIES_UPDATED_EVENT, refresh);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, []);

  if (alerts.length === 0) return null;

  return (
    <section
      className={cn(
        "grid gap-2",
        alerts.length === 1 && "grid-cols-1",
        alerts.length === 2 && "grid-cols-1 sm:grid-cols-2",
        alerts.length >= 3 && "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4"
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
