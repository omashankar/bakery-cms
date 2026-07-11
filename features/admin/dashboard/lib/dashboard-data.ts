import { loadCakes } from "@/features/admin/cakes/lib/cakes-repository";
import { getCustomerRecords } from "@/features/admin/commerce/lib/customer-utils";
import { ensureDemoOrders, getOrderStats } from "@/features/admin/commerce/lib/order-utils";
import { countNewInquiries } from "@/features/admin/inquiries";
import { loadMediaFiles } from "@/features/admin/media/lib/media-repository";
import { getActivityLog } from "@/features/admin/settings/lib/settings-repository";
import { getOrders, type PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import type { ActivityLog } from "@/types/settings";
import { formatCurrency } from "@/utils/format";

export interface DashboardStats {
  totalCakes: number;
  publishedCakes: number;
  draftCakes: number;
  newInquiries: number;
  mediaCount: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  activeOrders: number;
  cakesWeeklyChange: string;
  inquiryWeeklyChange: string;
  ordersChange: string;
  revenueChange: string;
  cakesChangeTone: "positive" | "neutral" | "warning";
  inquiryChangeTone: "positive" | "neutral" | "warning";
  ordersChangeTone: "positive" | "neutral" | "warning";
  revenueChangeTone: "positive" | "neutral" | "warning";
}

/** SSR-safe defaults — real values load after mount from localStorage. */
export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalCakes: 0,
  publishedCakes: 0,
  draftCakes: 0,
  newInquiries: 0,
  mediaCount: 0,
  totalOrders: 0,
  totalRevenue: 0,
  totalCustomers: 0,
  activeOrders: 0,
  cakesWeeklyChange: "—",
  inquiryWeeklyChange: "—",
  ordersChange: "—",
  revenueChange: "—",
  cakesChangeTone: "neutral",
  inquiryChangeTone: "neutral",
  ordersChangeTone: "neutral",
  revenueChangeTone: "neutral",
};

const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DashboardActivityItem {
  id: string;
  message: string;
  timestamp: string;
  entity: string;
}

export function getDashboardStats(): DashboardStats {
  const cakes = loadCakes();
  const publishedCakes = cakes.filter((cake) => cake.status === "published").length;
  const draftCakes = cakes.filter((cake) => cake.status === "draft").length;
  const featuredCount = cakes.filter((cake) => cake.isFeatured).length;
  const newInquiries = countNewInquiries();
  const mediaCount = loadMediaFiles().length;

  ensureDemoOrders();
  const orders = getOrders();
  const orderStats = getOrderStats(orders);
  const customers = getCustomerRecords();
  const activeOrders =
    orderStats.pending +
    orderStats.confirmed +
    orderStats.preparing +
    orderStats.ready +
    orderStats.outForDelivery;
  const deliveredOrders = orderStats.delivered;

  return {
    totalCakes: cakes.length,
    publishedCakes,
    draftCakes,
    newInquiries,
    mediaCount,
    totalOrders: orderStats.total,
    totalRevenue: orderStats.revenue,
    totalCustomers: customers.length,
    activeOrders,
    cakesWeeklyChange:
      featuredCount > 0
        ? `${featuredCount} featured in catalog`
        : `${publishedCakes} live on storefront`,
    inquiryWeeklyChange:
      newInquiries > 0 ? `${newInquiries} need attention` : "All caught up",
    ordersChange:
      activeOrders > 0
        ? `${activeOrders} need fulfillment`
        : deliveredOrders > 0
          ? `${deliveredOrders} delivered`
          : "No orders yet",
    revenueChange:
      orderStats.revenue > 0
        ? `${formatCurrency(orderStats.revenue)} lifetime`
        : "Revenue appears after checkout",
    cakesChangeTone: draftCakes > 0 ? "warning" : "positive",
    inquiryChangeTone: newInquiries > 0 ? "warning" : "positive",
    ordersChangeTone: activeOrders > 0 ? "warning" : "positive",
    revenueChangeTone: orderStats.revenue > 0 ? "positive" : "neutral",
  };
}

export function getRecentOrders(limit = 5): PlacedOrder[] {
  ensureDemoOrders();
  return getOrders().slice(0, limit);
}

export function getMonthlyRevenueTrend(): Array<{ month: string; revenue: number }> {
  ensureDemoOrders();
  const orders = getOrders();
  const buckets = new Map<string, number>();

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    buckets.set(key, 0);
  }

  for (const order of orders) {
    const date = new Date(order.placedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + order.totals.total);
    }
  }

  return Array.from(buckets.entries()).map(([key, revenue]) => {
    const monthIndex = Number(key.split("-")[1]);
    return {
      month: monthLabels[monthIndex] ?? "—",
      revenue,
    };
  });
}

export function getDashboardActivities(): DashboardActivityItem[] {
  return getActivityLog()
    .slice(0, 6)
    .map((entry) => ({
      id: entry.id,
      message: entry.details ?? `${entry.action} ${entry.entity}`,
      timestamp: entry.timestamp,
      entity: entry.entity,
    }));
}

export function formatActivityEntry(entry: ActivityLog): DashboardActivityItem {
  return {
    id: entry.id,
    message: entry.details ?? `${entry.action} ${entry.entity}`,
    timestamp: entry.timestamp,
    entity: entry.entity,
  };
}
