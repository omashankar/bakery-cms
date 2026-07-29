import { loadProducts } from "@/features/products/lib/products-repository";
import { countNewInquiries } from "@/apps/admin/inquiries";
import { loadMediaFiles } from "@/apps/admin/media/lib/media-repository";
import { getActivityLog } from "@/features/settings/lib/settings-repository";
import { getOrders, type PlacedOrder } from "@/features/orders/lib/orders";
import type { ActivityLog } from "@/types/settings";

/**
 * The non-order figures on the dashboard.
 *
 * Order totals deliberately do NOT live here. They are a total over the whole
 * collection, so they come from the server (`/api/orders/analytics`) — deriving
 * them from the browser's order cache produced a second, smaller answer that
 * looked just as plausible as the real one.
 */
export interface DashboardStats {
  totalCakes: number;
  publishedProducts: number;
  draftProducts: number;
  newInquiries: number;
  mediaCount: number;
  cakesWeeklyChange: string;
  inquiryWeeklyChange: string;
  cakesChangeTone: "positive" | "neutral" | "warning";
  inquiryChangeTone: "positive" | "neutral" | "warning";
}

/** SSR-safe defaults — real values load after mount from localStorage. */
export const EMPTY_DASHBOARD_STATS: DashboardStats = {
  totalCakes: 0,
  publishedProducts: 0,
  draftProducts: 0,
  newInquiries: 0,
  mediaCount: 0,
  cakesWeeklyChange: "—",
  inquiryWeeklyChange: "—",
  cakesChangeTone: "neutral",
  inquiryChangeTone: "neutral",
};

export interface DashboardActivityItem {
  id: string;
  message: string;
  timestamp: string;
  entity: string;
}

export function getDashboardStats(): DashboardStats {
  const cakes = loadProducts();
  const publishedProducts = cakes.filter((cake) => cake.status === "published").length;
  const draftProducts = cakes.filter((cake) => cake.status === "draft").length;
  const featuredCount = cakes.filter((cake) => cake.isFeatured).length;
  const newInquiries = countNewInquiries();
  const mediaCount = loadMediaFiles().length;

  return {
    totalCakes: cakes.length,
    publishedProducts,
    draftProducts,
    newInquiries,
    mediaCount,
    cakesWeeklyChange:
      featuredCount > 0
        ? `${featuredCount} featured in catalog`
        : `${publishedProducts} live on storefront`,
    inquiryWeeklyChange:
      newInquiries > 0 ? `${newInquiries} need attention` : "All caught up",
    cakesChangeTone: draftProducts > 0 ? "warning" : "positive",
    inquiryChangeTone: newInquiries > 0 ? "warning" : "positive",
  };
}

/** Newest orders first — the local cache is hydrated from the server on entry. */
export function getRecentOrders(limit = 5): PlacedOrder[] {
  return [...getOrders()]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, limit);
}

/**
 * Local-only fallback for the activity feed. The durable trail lives in the
 * server audit log (`/api/audit-logs`); this covers the moments before that
 * fetch resolves, and unauthenticated/offline reads where it returns nothing.
 */
export function getDashboardActivities(): DashboardActivityItem[] {
  return getActivityLog().slice(0, 6).map(formatActivityEntry);
}

export function formatActivityEntry(entry: ActivityLog): DashboardActivityItem {
  return {
    id: entry.id,
    message: entry.details ?? `${entry.action} ${entry.entity}`,
    timestamp: entry.timestamp,
    entity: entry.entity,
  };
}
