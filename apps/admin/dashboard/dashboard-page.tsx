"use client";

import { useEffect, useState } from "react";
import { IndianRupee, MessageSquare, Send, ShoppingBag } from "lucide-react";
import { getDemoSession } from "@/features/auth/lib/session";
import { formatCurrency, formatDate } from "@/utils/format";
import { routes } from "@/constants/routes";
import { DashboardActivityFeed } from "./components/dashboard-activity-feed";
import { DashboardAlertsStrip } from "./components/dashboard-alerts-strip";
import { DashboardInventoryWidget } from "./components/dashboard-inventory-widget";
import { DashboardInquiriesPanel } from "./components/dashboard-inquiries-panel";
import { DashboardOrderPipeline } from "./components/dashboard-order-pipeline";
import { DashboardPaymentMix } from "./components/dashboard-payment-mix";
import { DashboardQuickActions } from "./components/dashboard-quick-actions";
import { DashboardRangeSelect } from "./components/dashboard-range-select";
import { DashboardRecentOrders } from "./components/dashboard-recent-orders";
import { DashboardRevenueChart } from "./components/dashboard-revenue-chart";
import { DashboardStatCard } from "./components/dashboard-stat-card";
import { DashboardTopProducts } from "./components/dashboard-top-products";
import {
  EMPTY_DASHBOARD_COMMERCE_ANALYTICS,
  getDashboardRangeLabel,
  toDashboardCommerceAnalytics,
  type DashboardDateRange,
} from "./lib/dashboard-analytics";
import { EMPTY_DASHBOARD_STATS, getDashboardStats } from "./lib/dashboard-data";
import { subscribeToAdminData } from "@/apps/admin/lib/admin-data-events";
import { fetchOrderAnalytics } from "@/features/orders/lib/orders-api";
import { ORDERS_UPDATED_EVENT } from "@/features/orders/lib/orders";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";

export function DashboardPage() {
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_DASHBOARD_STATS);
  const [commerce, setCommerce] = useState(EMPTY_DASHBOARD_COMMERCE_ANALYTICS);
  const [range, setRange] = useState<DashboardDateRange>("30d");
  const [lastUpdated, setLastUpdated] = useState("");
  const [analyticsFailed, setAnalyticsFailed] = useState(false);

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
      setLastUpdated(formatDate(new Date()));
    }

    refresh();
    return subscribeToAdminData(refresh);
  }, []);

  // Every commerce figure on this page is a total over the range, so it is
  // computed on the server across every matching order — and fetched ONCE here
  // rather than by each card, which would be four requests for one answer.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      const result = await fetchOrderAnalytics(range);
      if (cancelled) return;
      if (result) setCommerce(toDashboardCommerceAnalytics(range, result));
      setAnalyticsFailed(!result);
    }

    void load();
    // Only the orders event, not all five. Each call is an aggregation over the
    // whole collection, and admin entry fires several of these events in quick
    // succession — subscribing to the lot turned one page view into a dozen
    // full-collection requests. Nothing here derives from products, inventory,
    // inquiries or notifications anyway.
    window.addEventListener(ORDERS_UPDATED_EVENT, load);

    return () => {
      // Both, not just the unsubscribe: a request already in flight would
      // otherwise still resolve and set state after this effect is torn down.
      cancelled = true;
      window.removeEventListener(ORDERS_UPDATED_EVENT, load);
    };
  }, [range]);

  // Label the range the FIGURES are for, not the one the selector is on — they
  // differ while a new range is loading, and captioning last month's revenue
  // "Last 7 days" is simply a wrong statement.
  const rangeLabel = getDashboardRangeLabel(commerce.range);
  const description = [
    greetingName ? `Welcome back, ${greetingName}` : null,
    rangeLabel,
    lastUpdated || null,
    // Saying nothing would leave ₹0 reading as fact.
    analyticsFailed ? "Figures unavailable — the server did not answer" : null,
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
          <DashboardRevenueChart analytics={commerce} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <DashboardOrderPipeline analytics={commerce} />
        </div>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <DashboardRecentOrders />
        <DashboardInquiriesPanel />
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardTopProducts analytics={commerce} />
        <DashboardInventoryWidget />
        <div className="sm:col-span-2 xl:col-span-1">
          <DashboardPaymentMix analytics={commerce} />
        </div>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <DashboardActivityFeed />
        <DashboardQuickActions />
      </section>
    </AdminPage>
  );
}
