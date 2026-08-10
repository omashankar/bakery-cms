import { getInventoryOverview } from "@/apps/admin/commerce/lib/inventory-repository";
import { countUnreadNotifications } from "@/apps/admin/commerce/lib/notifications-repository";
import { countNewInquiries } from "@/apps/admin/inquiries";
import {
  type PaymentBreakdownItem,
  type ReportDateRange,
  type ReportsSummary,
  type RevenueTrendPoint,
  type StatusBreakdownItem,
  type TopProductItem,
} from "@/apps/admin/reports/lib/reports-data";
import type { OrderAnalyticsResponse } from "@/features/orders/lib/orders-api";
import { routes } from "@/constants/routes";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { formatCurrency } from "@/utils/format";

export type DashboardDateRange = ReportDateRange;

export type DashboardDeltaTone = "positive" | "neutral" | "warning";

export interface DashboardDelta {
  label: string;
  tone: DashboardDeltaTone;
}

export interface DashboardCommerceAnalytics {
  range: DashboardDateRange;
  summary: ReportsSummary;
  revenueDelta: DashboardDelta;
  ordersDelta: DashboardDelta;
  aovDelta: DashboardDelta;
  trend: RevenueTrendPoint[];
  statusBreakdown: StatusBreakdownItem[];
  paymentBreakdown: PaymentBreakdownItem[];
  topProducts: TopProductItem[];
  activeOrders: number;
}

const emptySummary: ReportsSummary = {
  revenue: 0,
  orders: 0,
  averageOrderValue: 0,
  delivered: 0,
  cancelled: 0,
  refunded: 0,
  couponDiscount: 0,
  itemsSold: 0,
  activeOrders: 0,
  uniqueCustomers: 0,
  deliveryFees: 0,
  taxCollected: 0,
  prepaidOrders: 0,
  codOrders: 0,
};

const neutralDelta: DashboardDelta = { label: "—", tone: "neutral" };

/** SSR-safe defaults — real analytics load after mount from localStorage. */
export const EMPTY_DASHBOARD_COMMERCE_ANALYTICS: DashboardCommerceAnalytics = {
  range: "30d",
  summary: emptySummary,
  revenueDelta: neutralDelta,
  ordersDelta: neutralDelta,
  aovDelta: neutralDelta,
  trend: [],
  statusBreakdown: [],
  paymentBreakdown: [],
  topProducts: [],
  activeOrders: 0,
};

export interface DashboardAlert {
  id: string;
  label: string;
  value: string;
  href: string;
  tone: "warning" | "destructive" | "neutral";
}

export function formatDashboardDelta(current: number, previous: number): DashboardDelta {
  if (current === 0 && previous === 0) {
    return { label: "No activity in range", tone: "neutral" };
  }

  if (previous === 0) {
    return { label: "New vs prior period", tone: "positive" };
  }

  const percent = Math.round(((current - previous) / previous) * 100);

  if (percent > 0) {
    return { label: `+${percent}% vs prior period`, tone: "positive" };
  }

  if (percent < 0) {
    return { label: `${percent}% vs prior period`, tone: "warning" };
  }

  return { label: "Flat vs prior period", tone: "neutral" };
}

export function getActiveOrderCount(orders: PlacedOrder[]): number {
  return orders.filter((order) =>
    ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status)
  ).length;
}

/**
 * Reshapes the server's analytics into what the dashboard cards render.
 *
 * The figures are computed server-side over every order in the range; only the
 * dashboard's own delta wording is applied here. Previously the whole thing was
 * computed in the browser from the cached order slice, so every card understated
 * itself once a shop had more orders than the cache holds.
 */
export function toDashboardCommerceAnalytics(
  range: DashboardDateRange,
  response: OrderAnalyticsResponse
): DashboardCommerceAnalytics {
  const { summary, previousSummary } = response;

  /**
   * "All time" has no prior period to compare against.
   *
   * `getAnalyticsWindow` returns `previousStart: null` for it and
   * `filterOrdersInPreviousWindow` answers with an empty array, so
   * `previousSummary` is all zeros — and `formatDashboardDelta` reads a zero
   * previous as "New vs prior period" and paints it green. Every all-time
   * dashboard therefore claimed growth against a period that does not exist,
   * on the shop's revenue and order count. The Reports page carries the same
   * rule as `showComparison = shownRange !== "all"`.
   */
  const comparable = range !== "all";
  const delta = (current: number, previous: number): DashboardDelta =>
    comparable
      ? formatDashboardDelta(current, previous)
      : { label: "All-time total", tone: "neutral" };

  return {
    range,
    summary,
    revenueDelta: delta(summary.revenue, previousSummary.revenue),
    ordersDelta: delta(summary.orders, previousSummary.orders),
    aovDelta: delta(summary.averageOrderValue, previousSummary.averageOrderValue),
    trend: response.trend,
    statusBreakdown: response.statusBreakdown,
    paymentBreakdown: response.paymentBreakdown,
    topProducts: response.topProducts,
    // getReportsSummary counts exactly the statuses getActiveOrderCount does.
    activeOrders: summary.activeOrders,
  };
}

export function getDashboardAlerts(): DashboardAlert[] {
  const inventory = getInventoryOverview();
  const newInquiries = countNewInquiries();
  const unreadNotifications = countUnreadNotifications();
  const alerts: DashboardAlert[] = [];

  if (inventory.outOfStock > 0) {
    alerts.push({
      id: "inventory-out",
      label: "Out of stock",
      value: `${inventory.outOfStock} product${inventory.outOfStock === 1 ? "" : "s"}`,
      href: routes.admin.commerce.inventory,
      tone: "destructive",
    });
  }

  if (inventory.lowStock > 0) {
    alerts.push({
      id: "inventory-low",
      label: "Low stock",
      value: `${inventory.lowStock} SKU${inventory.lowStock === 1 ? "" : "s"}`,
      href: routes.admin.commerce.inventory,
      tone: "warning",
    });
  }

  if (newInquiries > 0) {
    alerts.push({
      id: "inquiries-new",
      label: "New inquiries",
      value: String(newInquiries),
      href: routes.admin.inquiries.overview,
      tone: "warning",
    });
  }

  if (unreadNotifications > 0) {
    alerts.push({
      id: "notifications-unread",
      label: "Unread alerts",
      value: String(unreadNotifications),
      href: routes.admin.commerce.notifications,
      tone: "neutral",
    });
  }

  return alerts;
}

export function getDashboardRangeLabel(range: DashboardDateRange): string {
  const labels: Record<DashboardDateRange, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "12m": "Last 12 months",
    all: "All time",
  };
  return labels[range];
}

export function formatDashboardRevenueSubtitle(summary: ReportsSummary): string {
  if (summary.revenue <= 0) {
    return "Revenue appears after checkout orders";
  }
  return `${summary.orders} order${summary.orders === 1 ? "" : "s"} · ${formatCurrency(summary.averageOrderValue)} AOV`;
}
