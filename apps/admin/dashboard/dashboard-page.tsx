"use client";

import { useEffect, useState } from "react";
import { IndianRupee, MessageSquare, Send, ShoppingBag } from "lucide-react";
import { getDemoSession } from "@/features/auth/lib/session";
import { formatCurrency, formatDate } from "@/utils/format";
import { routes } from "@/constants/routes";
import { DashboardAlertsStrip } from "./components/dashboard-alerts-strip";
import { DashboardInventoryWidget } from "./components/dashboard-inventory-widget";
import { DashboardInquiriesPanel } from "./components/dashboard-inquiries-panel";
import { DashboardOrderPipeline } from "./components/dashboard-order-pipeline";
import { DashboardQuickActions } from "./components/dashboard-quick-actions";
import { DashboardRangeSelect } from "./components/dashboard-range-select";
import { DashboardRecentOrders } from "./components/dashboard-recent-orders";
import { DashboardRevenueChart } from "./components/dashboard-revenue-chart";
import { DashboardStatCard } from "./components/dashboard-stat-card";
import { DashboardTopProducts } from "./components/dashboard-top-products";
import {
  EMPTY_DASHBOARD_COMMERCE_ANALYTICS,
  getDashboardCommerceAnalytics,
  getDashboardRangeLabel,
  type DashboardDateRange,
} from "./lib/dashboard-analytics";
import { EMPTY_DASHBOARD_STATS, getDashboardStats } from "./lib/dashboard-data";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";

export function DashboardPage() {
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_DASHBOARD_STATS);
  const [commerce, setCommerce] = useState(EMPTY_DASHBOARD_COMMERCE_ANALYTICS);
  const [range, setRange] = useState<DashboardDateRange>("30d");
  const [lastUpdated, setLastUpdated] = useState("");

  useEffect(() => {
    const session = getDemoSession();
    if (session?.email) {
      const localPart = session.email.split("@")[0] ?? "Admin";
      const formatted =
        localPart.charAt(0).toUpperCase() + localPart.slice(1).replace(/[._-]/g, " ");
      setGreetingName(formatted.trim());
    }

    function refresh() {
      setStats(getDashboardStats());
      setCommerce(getDashboardCommerceAnalytics(range));
      setLastUpdated(formatDate(new Date()));
    }

    refresh();
    window.addEventListener("bakery-orders-updated", refresh);
    window.addEventListener("bakery-inventory-updated", refresh);
    window.addEventListener("bakery-inquiries-updated", refresh);
    window.addEventListener("bakery-notifications-updated", refresh);

    return () => {
      window.removeEventListener("bakery-orders-updated", refresh);
      window.removeEventListener("bakery-inventory-updated", refresh);
      window.removeEventListener("bakery-inquiries-updated", refresh);
      window.removeEventListener("bakery-notifications-updated", refresh);
    };
  }, [range]);

  const rangeLabel = getDashboardRangeLabel(range);
  const description = [
    greetingName ? `Welcome back, ${greetingName}` : null,
    rangeLabel,
    lastUpdated || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Dashboard"
        description={description || undefined}
        className="gap-3"
        actions={
          <DashboardRangeSelect
            value={range}
            onChange={setRange}
            className="w-full sm:w-40"
          />
        }
      />

      <DashboardAlertsStrip />

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
        <DashboardStatCard
          title="Revenue"
          value={formatCurrency(commerce.summary.revenue)}
          change={commerce.revenueDelta.label}
          changeTone={commerce.revenueDelta.tone}
          icon={IndianRupee}
          tone="gold"
          href={routes.admin.reports}
        />
        <DashboardStatCard
          title="Orders"
          value={commerce.summary.orders}
          change={commerce.ordersDelta.label}
          changeTone={commerce.ordersDelta.tone}
          icon={ShoppingBag}
          tone="bakery"
          href={routes.admin.orders.list}
        />
        <DashboardStatCard
          title="Active orders"
          value={commerce.activeOrders}
          change={commerce.activeOrders > 0 ? "Needs fulfillment" : "All clear"}
          changeTone={commerce.activeOrders > 0 ? "warning" : "positive"}
          icon={Send}
          tone="bakery"
          href={routes.admin.orders.list}
        />
        <DashboardStatCard
          title="New inquiries"
          value={stats.newInquiries}
          change={stats.inquiryWeeklyChange}
          changeTone={stats.inquiryChangeTone}
          icon={MessageSquare}
          tone="bakery"
          href={routes.admin.inquiries.overview}
        />
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <DashboardRevenueChart range={range} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <DashboardOrderPipeline range={range} />
        </div>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <DashboardRecentOrders />
        <DashboardInquiriesPanel />
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardTopProducts range={range} />
        <DashboardInventoryWidget />
        <div className="sm:col-span-2 xl:col-span-1">
          <DashboardQuickActions />
        </div>
      </section>
    </AdminPage>
  );
}
