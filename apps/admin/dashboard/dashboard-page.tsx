"use client";

import { useEffect, useRef, useState } from "react";
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
import { type FiguresState } from "@/components/shared/panel-loading";

const MAX_REFRESH_RETRIES = 4;
const REFRESH_RETRY_BASE_MS = 5_000;

export function DashboardPage() {
  const [greetingName, setGreetingName] = useState<string | null>(null);
  const [stats, setStats] = useState(EMPTY_DASHBOARD_STATS);
  const [commerce, setCommerce] = useState(EMPTY_DASHBOARD_COMMERCE_ANALYTICS);
  const [range, setRange] = useState<DashboardDateRange>("30d");
  const [lastUpdated, setLastUpdated] = useState("");
  const [analyticsFailed, setAnalyticsFailed] = useState(false);
  // "Nothing has loaded" and "the last refresh failed" are different things to
  // say, and the caption said the first for both.
  const [loadedOnce, setLoadedOnce] = useState(false);
  // `stats` reads synchronously, but the effect that fills it runs after the
  // browser paints — so "New inquiries 0" was on screen for a frame regardless.
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const attempts = useRef(0);
  /** Which range `attempts` is counting for — changing range starts over. */
  const loadedRange = useRef(range);

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
      setStatsLoaded(true);
    }

    refresh();
    return subscribeToAdminData(refresh);
  }, []);

  // Every commerce figure on this page is a total over the range, so it is
  // computed on the server across every matching order — and fetched ONCE here
  // rather than by each card, which would be four requests for one answer.
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      if (loadedRange.current !== range) {
        loadedRange.current = range;
        attempts.current = 0;
      }

      const result = await fetchOrderAnalytics(range);
      if (cancelled) return;

      if (result) {
        attempts.current = 0;
        setCommerce(toDashboardCommerceAnalytics(range, result));
        setLoadedOnce(true);
        setAnalyticsFailed(false);
        return;
      }

      setAnalyticsFailed(true);
      /**
       * Retry, with the same backoff Reports uses.
       *
       * This page's only other trigger is an order mutation elsewhere in the
       * admin, so a single blip froze the figures for as long as the tab stayed
       * open — and captioned them "Figures unavailable" while they were the
       * shop's real numbers from a moment earlier. Both halves were already
       * repaired in reports-page.tsx and left here.
       */
      if (attempts.current < MAX_REFRESH_RETRIES) {
        const delay = REFRESH_RETRY_BASE_MS * 2 ** attempts.current;
        attempts.current += 1;
        retry = setTimeout(() => setRetryKey((value) => value + 1), delay);
      }
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
      if (retry !== undefined) clearTimeout(retry);
      window.removeEventListener(ORDERS_UPDATED_EVENT, load);
    };
  }, [range, retryKey]);

  // Label the range the FIGURES are for, not the one the selector is on — they
  // differ while a new range is loading, and captioning last month's revenue
  // "Last 7 days" is simply a wrong statement.
  const rangeLabel = getDashboardRangeLabel(commerce.range);

  /**
   * Nothing has answered yet, so every commerce figure on screen is the zero
   * `EMPTY_DASHBOARD_COMMERCE_ANALYTICS` starts at.
   *
   * The caption already distinguished "never loaded" from "the last refresh
   * failed", but only in the failure case — while the FIRST request was simply
   * in flight it said nothing at all, and eight zeroes stood as the shop's
   * numbers: Revenue ₹0.00, Orders 0, "Active orders 0 — All clear" in green,
   * "No orders yet", "No payment data in this period.", "No sales yet". On
   * every cold load of every shop.
   *
   * A failed load keeps whatever it managed to read: `loadedOnce` means there
   * are real figures on screen, and blanking them to skeletons would throw away
   * true numbers to report a transient error.
   */
  const analyticsFigures: FiguresState = loadedOnce
    ? "ready"
    : analyticsFailed
      ? "unavailable"
      : "loading";

  const description = [
    greetingName ? `Welcome back, ${greetingName}` : null,
    rangeLabel,
    lastUpdated || null,
    analyticsFigures === "loading" ? "Loading figures…" : null,
    // Saying nothing would leave ₹0 reading as fact.
    analyticsFailed
      ? loadedOnce
        ? "Showing the last figures — the server did not answer"
        : "Figures unavailable — the server did not answer"
      : null,
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
          figures={analyticsFigures}
          href={routes.admin.reports}
        />
        <DashboardStatCard
          title="Orders"
          value={commerce.summary.orders}
          figures={analyticsFigures}
          change={commerce.ordersDelta.label}
          changeTone={commerce.ordersDelta.tone}
          icon={ShoppingBag}
          tone="bakery"
          href={routes.admin.orders.list}
        />
        <DashboardStatCard
          title="Active orders"
          value={commerce.activeOrders}
          figures={analyticsFigures}
          change={commerce.activeOrders > 0 ? "Needs fulfillment" : "All clear"}
          changeTone={commerce.activeOrders > 0 ? "warning" : "positive"}
          icon={Send}
          tone="bakery"
          href={routes.admin.orders.list}
        />
        <DashboardStatCard
          title="New inquiries"
          value={stats.newInquiries}
          figures={statsLoaded ? "ready" : "loading"}
          change={stats.inquiryWeeklyChange}
          changeTone={stats.inquiryChangeTone}
          icon={MessageSquare}
          tone="bakery"
          href={routes.admin.inquiries.overview}
        />
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <DashboardRevenueChart analytics={commerce} figures={analyticsFigures} />
        </div>
        <div className="min-w-0 lg:col-span-4">
          <DashboardOrderPipeline analytics={commerce} figures={analyticsFigures} />
        </div>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <DashboardRecentOrders />
        <DashboardInquiriesPanel />
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardTopProducts analytics={commerce} figures={analyticsFigures} />
        <DashboardInventoryWidget />
        <div className="sm:col-span-2 xl:col-span-1">
          <DashboardPaymentMix analytics={commerce} figures={analyticsFigures} />
        </div>
      </section>

      <section className="grid items-stretch gap-3 sm:gap-4 lg:grid-cols-2">
        <DashboardActivityFeed />
        <DashboardQuickActions />
      </section>
    </AdminPage>
  );
}
