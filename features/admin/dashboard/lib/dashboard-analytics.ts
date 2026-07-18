import { getInventoryOverview } from "@/features/admin/commerce/lib/inventory-repository";
import { countUnreadNotifications } from "@/features/admin/commerce/lib/notifications-repository";
import { countNewInquiries } from "@/features/admin/inquiries";
import {
  filterOrdersByRange,
  getPaymentBreakdown,
  getRangeStart,
  getReportsSummary,
  getRevenueTrend,
  getStatusBreakdown,
  getTopProducts,
  loadReportOrders,
  type PaymentBreakdownItem,
  type ReportDateRange,
  type ReportsSummary,
  type RevenueTrendPoint,
  type StatusBreakdownItem,
  type TopProductItem,
} from "@/features/admin/reports/lib/reports-data";
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

function filterOrdersByPreviousRange(
  orders: PlacedOrder[],
  range: DashboardDateRange
): PlacedOrder[] {
  const start = getRangeStart(range);
  if (!start) return [];

  const durationMs = Date.now() - start.getTime();
  const previousStart = new Date(start.getTime() - durationMs);

  return orders.filter((order) => {
    const placedAt = new Date(order.placedAt);
    return placedAt >= previousStart && placedAt < start;
  });
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

export function getDashboardCommerceAnalytics(
  range: DashboardDateRange = "30d"
): DashboardCommerceAnalytics {
  const orders = loadReportOrders();
  const currentOrders = filterOrdersByRange(orders, range);
  const previousOrders = filterOrdersByPreviousRange(orders, range);
  const currentSummary = getReportsSummary(currentOrders);
  const previousSummary = getReportsSummary(previousOrders);

  return {
    range,
    summary: currentSummary,
    revenueDelta: formatDashboardDelta(currentSummary.revenue, previousSummary.revenue),
    ordersDelta: formatDashboardDelta(currentSummary.orders, previousSummary.orders),
    aovDelta: formatDashboardDelta(
      currentSummary.averageOrderValue,
      previousSummary.averageOrderValue
    ),
    trend: getRevenueTrend(orders, range),
    statusBreakdown: getStatusBreakdown(currentOrders),
    paymentBreakdown: getPaymentBreakdown(currentOrders),
    topProducts: getTopProducts(currentOrders, 5),
    activeOrders: getActiveOrderCount(currentOrders),
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
