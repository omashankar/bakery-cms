import type { Metadata } from "next";
import { DashboardPage } from "@/apps/admin/dashboard/dashboard-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readOrderAnalytics } from "@/features/orders/server/order.initial";
import { getAuditLogs } from "@/features/audit/server/audit.service";
import { getOrdersPage } from "@/features/orders/server/order.service";
import { orderQuerySchema } from "@/features/orders/server/order.validators";
import { auditQuerySchema } from "@/features/audit/server/audit.validators";
import type { Permission } from "@/features/team/lib/permissions";
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
 *
 * Each part only for someone allowed it: the figures are revenue, the feed is
 * the activity log, the orders are customer data. A part they may not see is
 * null, and the screen leaves that card out.
 */
export default async function Page() {
  const initial = await whenAllowed("dashboard.view", async (actor) => {
    const may = (p: Permission) => actor.permissions.has(p);
    const [analytics, activity, recent] = await Promise.all([
      may("reports.revenue.view")
        ? readOrderAnalytics(DEFAULT_DASHBOARD_RANGE, actor.permissions)
        : null,
      may("security.view")
        ? getAuditLogs(auditQuerySchema.parse({ limit: DASHBOARD_FEED_LIMIT }))
        : null,
      // Newest first, as the card sorts its cache.
      may("orders.view")
        ? getOrdersPage(orderQuerySchema.parse({ page: "1", limit: String(DASHBOARD_RECENT_ORDERS) }))
        : null,
    ]);
    return JSON.parse(
      JSON.stringify({
        analytics,
        activity: activity?.items ?? null,
        recentOrders: recent?.items ?? null,
      }),
    );
  });
  return <DashboardPage initial={initial} />;
}
