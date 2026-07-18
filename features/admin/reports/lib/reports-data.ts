import { ensureDemoOrders } from "@/features/admin/commerce/lib/order-utils";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import { getOrders } from "@/features/orders/lib/orders";

export type ReportDateRange = "7d" | "30d" | "90d" | "12m" | "all";

export interface ReportsSummary {
  revenue: number;
  orders: number;
  averageOrderValue: number;
  delivered: number;
  cancelled: number;
  refunded: number;
  couponDiscount: number;
  itemsSold: number;
  activeOrders: number;
  uniqueCustomers: number;
  deliveryFees: number;
  taxCollected: number;
  prepaidOrders: number;
  codOrders: number;
}

export interface ReportDelta {
  label: string;
  tone: "positive" | "neutral" | "warning";
}

export interface ReportsComparison {
  revenue: ReportDelta;
  orders: ReportDelta;
  averageOrderValue: ReportDelta;
  itemsSold: ReportDelta;
}

export interface RevenueTrendPoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface StatusBreakdownItem {
  status: PlacedOrder["status"];
  count: number;
  revenue: number;
}

export interface PaymentBreakdownItem {
  key: string;
  label: string;
  count: number;
  revenue: number;
}

export interface TopProductItem {
  slug: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopCustomerItem {
  email: string;
  name: string;
  orders: number;
  revenue: number;
}

export interface CityBreakdownItem {
  city: string;
  orders: number;
  revenue: number;
}

export interface CouponBreakdownItem {
  code: string;
  uses: number;
  discount: number;
}

const monthLabels = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ACTIVE_STATUSES: PlacedOrder["status"][] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
];

function isCountableRevenue(order: PlacedOrder): boolean {
  return order.status !== "cancelled" && order.status !== "refunded";
}

export function loadReportOrders(): PlacedOrder[] {
  ensureDemoOrders();
  return getOrders();
}

export function getRangeStart(range: ReportDateRange): Date | null {
  if (range === "all") return null;
  const start = new Date();
  if (range === "7d") start.setDate(start.getDate() - 6);
  if (range === "30d") start.setDate(start.getDate() - 29);
  if (range === "90d") start.setDate(start.getDate() - 89);
  if (range === "12m") start.setMonth(start.getMonth() - 11);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function filterOrdersByRange(
  orders: PlacedOrder[],
  range: ReportDateRange
): PlacedOrder[] {
  const start = getRangeStart(range);
  if (!start) return orders;
  return orders.filter((order) => new Date(order.placedAt) >= start);
}

export function filterOrdersByPreviousRange(
  orders: PlacedOrder[],
  range: ReportDateRange
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

export function formatReportDelta(current: number, previous: number): ReportDelta {
  if (current === 0 && previous === 0) {
    return { label: "No change", tone: "neutral" };
  }
  if (previous === 0) {
    return { label: "New vs prior", tone: "positive" };
  }

  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent > 0) return { label: `+${percent}% vs prior`, tone: "positive" };
  if (percent < 0) return { label: `${percent}% vs prior`, tone: "warning" };
  return { label: "Flat vs prior", tone: "neutral" };
}

export function getReportsSummary(orders: PlacedOrder[]): ReportsSummary {
  const countable = orders.filter(isCountableRevenue);
  const revenue = countable.reduce((sum, order) => sum + order.totals.total, 0);
  const itemsSold = countable.reduce(
    (sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0
  );
  const couponDiscount = orders.reduce((sum, order) => sum + (order.totals.discount ?? 0), 0);
  const uniqueCustomers = new Set(
    orders.map((order) => order.address.email.toLowerCase()).filter(Boolean)
  ).size;

  return {
    revenue,
    orders: orders.length,
    averageOrderValue: countable.length > 0 ? Math.round(revenue / countable.length) : 0,
    delivered: orders.filter((order) => order.status === "delivered").length,
    cancelled: orders.filter((order) => order.status === "cancelled").length,
    refunded: orders.filter((order) => order.status === "refunded").length,
    couponDiscount,
    itemsSold,
    activeOrders: orders.filter((order) => ACTIVE_STATUSES.includes(order.status)).length,
    uniqueCustomers,
    deliveryFees: countable.reduce((sum, order) => sum + (order.totals.delivery ?? 0), 0),
    taxCollected: countable.reduce((sum, order) => sum + (order.totals.tax ?? 0), 0),
    prepaidOrders: orders.filter((order) => order.paymentMethod !== "cod").length,
    codOrders: orders.filter((order) => order.paymentMethod === "cod").length,
  };
}

export function getReportsComparison(
  current: ReportsSummary,
  previous: ReportsSummary
): ReportsComparison {
  return {
    revenue: formatReportDelta(current.revenue, previous.revenue),
    orders: formatReportDelta(current.orders, previous.orders),
    averageOrderValue: formatReportDelta(current.averageOrderValue, previous.averageOrderValue),
    itemsSold: formatReportDelta(current.itemsSold, previous.itemsSold),
  };
}

export function getRevenueTrend(
  orders: PlacedOrder[],
  range: ReportDateRange
): RevenueTrendPoint[] {
  const filtered = filterOrdersByRange(orders, range);
  const useDaily = range === "7d" || range === "30d";
  const buckets = new Map<string, RevenueTrendPoint>();

  if (useDaily) {
    const days = range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, {
        label: date.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        revenue: 0,
        orders: 0,
      });
    }
  } else {
    const months = range === "90d" ? 3 : 12;
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      buckets.set(key, {
        label: monthLabels[date.getMonth()] ?? "—",
        revenue: 0,
        orders: 0,
      });
    }
  }

  for (const order of filtered) {
    const date = new Date(order.placedAt);
    const key = useDaily
      ? date.toISOString().slice(0, 10)
      : `${date.getFullYear()}-${date.getMonth()}`;

    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.orders += 1;
    if (isCountableRevenue(order)) {
      bucket.revenue += order.totals.total;
    }
  }

  return Array.from(buckets.values());
}

export function getStatusBreakdown(orders: PlacedOrder[]): StatusBreakdownItem[] {
  const statuses: PlacedOrder["status"][] = [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "refunded",
  ];

  return statuses
    .map((status) => {
      const matched = orders.filter((order) => order.status === status);
      return {
        status,
        count: matched.length,
        revenue: matched
          .filter(isCountableRevenue)
          .reduce((sum, order) => sum + order.totals.total, 0),
      };
    })
    .filter((item) => item.count > 0);
}

export function getPaymentBreakdown(orders: PlacedOrder[]): PaymentBreakdownItem[] {
  const map = new Map<string, PaymentBreakdownItem>();

  for (const order of orders) {
    const key = order.paymentMethod;
    const label =
      key === "cod"
        ? "Cash on Delivery"
        : key === "upi"
          ? "UPI"
          : key === "card"
            ? "Card"
            : key;

    const current = map.get(key) ?? { key, label, count: 0, revenue: 0 };
    current.count += 1;
    if (isCountableRevenue(order)) {
      current.revenue += order.totals.total;
    }
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function getTopProducts(orders: PlacedOrder[], limit = 5): TopProductItem[] {
  const map = new Map<string, TopProductItem>();

  for (const order of orders.filter(isCountableRevenue)) {
    for (const item of order.items) {
      const current = map.get(item.productSlug) ?? {
        slug: item.productSlug,
        name: item.name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity;
      map.set(item.productSlug, current);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function getTopCustomers(orders: PlacedOrder[], limit = 5): TopCustomerItem[] {
  const map = new Map<string, TopCustomerItem>();

  for (const order of orders.filter(isCountableRevenue)) {
    const email = order.address.email.toLowerCase();
    const current = map.get(email) ?? {
      email,
      name: order.address.fullName,
      orders: 0,
      revenue: 0,
    };
    current.orders += 1;
    current.revenue += order.totals.total;
    map.set(email, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function getCityBreakdown(orders: PlacedOrder[], limit = 5): CityBreakdownItem[] {
  const map = new Map<string, CityBreakdownItem>();

  for (const order of orders.filter(isCountableRevenue)) {
    const city = (order.address.city || "Unknown").trim();
    const key = city.toLowerCase();
    const current = map.get(key) ?? { city, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += order.totals.total;
    map.set(key, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

export function getCouponBreakdown(orders: PlacedOrder[], limit = 5): CouponBreakdownItem[] {
  const map = new Map<string, CouponBreakdownItem>();

  for (const order of orders) {
    const code = order.coupon?.code?.trim();
    if (!code) continue;
    const key = code.toUpperCase();
    const current = map.get(key) ?? { code: key, uses: 0, discount: 0 };
    current.uses += 1;
    current.discount += order.totals.discount ?? order.coupon?.discountAmount ?? 0;
    map.set(key, current);
  }

  return Array.from(map.values())
    .sort((a, b) => b.uses - a.uses)
    .slice(0, limit);
}

export function getRecentReportOrders(orders: PlacedOrder[], limit = 6): PlacedOrder[] {
  return [...orders]
    .sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime())
    .slice(0, limit);
}

export function exportReportsCsv(
  summary: ReportsSummary,
  products: TopProductItem[],
  customers: TopCustomerItem[],
  cities: CityBreakdownItem[],
  coupons: CouponBreakdownItem[],
  payments: PaymentBreakdownItem[],
  range: ReportDateRange
): void {
  if (typeof window === "undefined") return;

  const lines = [
    ["Bakery CMS Reports Export"],
    ["Range", range],
    ["Generated", new Date().toISOString()],
    [],
    ["Summary Metric", "Value"],
    ["Revenue", String(summary.revenue)],
    ["Orders", String(summary.orders)],
    ["Average Order Value", String(summary.averageOrderValue)],
    ["Items Sold", String(summary.itemsSold)],
    ["Active Orders", String(summary.activeOrders)],
    ["Unique Customers", String(summary.uniqueCustomers)],
    ["Delivered", String(summary.delivered)],
    ["Cancelled", String(summary.cancelled)],
    ["Refunded", String(summary.refunded)],
    ["Coupon Discount", String(summary.couponDiscount)],
    ["Delivery Fees", String(summary.deliveryFees)],
    ["Tax Collected", String(summary.taxCollected)],
    ["COD Orders", String(summary.codOrders)],
    ["Prepaid Orders", String(summary.prepaidOrders)],
    [],
    ["Top Products", "Quantity", "Revenue"],
    ...products.map((item) => [item.name, String(item.quantity), String(item.revenue)]),
    [],
    ["Top Customers", "Orders", "Revenue", "Email"],
    ...customers.map((item) => [
      item.name,
      String(item.orders),
      String(item.revenue),
      item.email,
    ]),
    [],
    ["Cities", "Orders", "Revenue"],
    ...cities.map((item) => [item.city, String(item.orders), String(item.revenue)]),
    [],
    ["Coupons", "Uses", "Discount"],
    ...coupons.map((item) => [item.code, String(item.uses), String(item.discount)]),
    [],
    ["Payments", "Orders", "Revenue"],
    ...payments.map((item) => [item.label, String(item.count), String(item.revenue)]),
  ];

  const csv = lines
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-reports-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
