import type { Metadata } from "next";
import { DashboardPage } from "@/apps/admin/dashboard/dashboard-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readOrderAnalytics } from "@/features/orders/server/order.initial";
import { getAuditLogs } from "@/features/audit/server/audit.service";
import { getOrdersPage } from "@/features/orders/server/order.service";
import { orderQuerySchema } from "@/features/orders/server/order.validators";
import { auditQuerySchema } from "@/features/audit/server/audit.validators";
import {
  DASHBOARD_FEED_LIMIT,
  DASHBOARD_RECENT_ORDERS,
  DEFAULT_DASHBOARD_RANGE,
} from "@/apps/admin/dashboard/lib/dashboard-defaults";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Statistics, charts, recent activity, and quick actions.",
};

/**
 * The default range's figures, the activity feed and the newest orders, read
 * with the page — the requests this screen used to wait on after it arrived.
 */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const [analytics, activity, recent] = await Promise.all([
      readOrderAnalytics(DEFAULT_DASHBOARD_RANGE),
      getAuditLogs(auditQuerySchema.parse({ limit: DASHBOARD_FEED_LIMIT })),
      // Newest first, as the card sorts its cache.
      getOrdersPage(orderQuerySchema.parse({ page: "1", limit: String(DASHBOARD_RECENT_ORDERS) })),
    ]);
    return JSON.parse(
      JSON.stringify({ analytics, activity: activity.items, recentOrders: recent.items }),
    );
  });
  return <DashboardPage initial={initial} />;
}
