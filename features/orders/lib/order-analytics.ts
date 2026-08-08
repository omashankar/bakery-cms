/**
 * Pure order analytics — summaries, trends and breakdowns over a set of orders.
 *
 * Lives in the domain layer, not in apps/admin, because the SERVER runs these
 * too: the admin's report and dashboard figures are computed over every order in
 * Mongo, and a second implementation there would drift from this one. One set of
 * functions, one definition of "revenue", whoever is asking.
 */
import type { PlacedOrder } from "@/features/orders/lib/orders";
import {
  DEFAULT_TIME_ZONE,
  zonedDayKey,
  zonedMidnight,
  zonedMonthKey,
  zonedParts,
  zonedStartOfDay,
  zonedStartOfMonth,
} from "./viewer-time";

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

/**
 * What the shop KEPT from an order, not what it billed.
 *
 * Every revenue figure here summed `totals.total` and excluded whole statuses.
 * But an order only becomes `refunded` when the refund is BOTH full and settled,
 * so a partial refund leaves it `delivered` forever and its full total kept
 * counting: a ₹2,000 order refunded ₹1,500 for a quality complaint reported
 * ₹2,000 across the summary, the trend, the payment mix, top products, top
 * customers and the city breakdown.
 *
 * `refundRecord.amount` is the TOTAL refunded across every attempt, which is
 * what makes this a subtraction rather than a per-attempt walk.
 */
function keptRevenue(order: PlacedOrder): number {
  if (!isCountableRevenue(order)) return 0;
  return Math.max(0, order.totals.total - (order.refundRecord?.amount ?? 0));
}

/**
 * "Jul", or "Jul 25" when the chart spans more than one year.
 *
 * An all-time trend runs from the first order ever placed, so a bare month name
 * repeats once per year of history and the x-axis stops meaning anything.
 */
function monthLabel(ms: number, timeZone: string, withYear: boolean): string {
  const { year, month } = zonedParts(ms, timeZone);
  const name = monthLabels[month] ?? "—";
  return withYear ? `${name} ${String(year).slice(-2)}` : name;
}

/**
 * Midnight, in the viewer's zone, at the start of the range.
 *
 * `nowMs` is a parameter so a caller that needs several boundaries gets them all
 * from ONE clock reading. Sampling the clock repeatedly inside one request is not
 * merely imprecise: it can put the database's lower bound and the in-memory
 * filter's lower bound on opposite sides of an order.
 */
export function getRangeStart(
  range: ReportDateRange,
  timeZone: string = DEFAULT_TIME_ZONE,
  nowMs = Date.now()
): Date | null {
  if (range === "all") return null;

  if (range === "12m") {
    const today = zonedParts(nowMs, timeZone);
    // Subtracting months from a day the target month does not have rolls the
    // date FORWARD — on 31 March, "11 months back" became 1 May, shortening the
    // window by a month. Clamp to the target month's last day instead.
    const target = zonedParts(zonedStartOfMonth(nowMs, timeZone, -11), timeZone);
    const daysInMonth = new Date(Date.UTC(target.year, target.month + 1, 0)).getUTCDate();
    return new Date(
      zonedMidnight(target.year, target.month, Math.min(today.day, daysInMonth), timeZone)
    );
  }

  const daysBack = range === "7d" ? 6 : range === "30d" ? 29 : 89;
  return new Date(zonedStartOfDay(nowMs, timeZone, -daysBack));
}

/** Both period boundaries, derived from a single clock reading. */
export interface AnalyticsWindow {
  /** Inclusive lower bound of the current period; null means all time. */
  start: Date | null;
  /** Inclusive lower bound of the comparison period; null when there is none. */
  previousStart: Date | null;
}

export function getAnalyticsWindow(
  range: ReportDateRange,
  timeZone: string = DEFAULT_TIME_ZONE,
  nowMs = Date.now()
): AnalyticsWindow {
  const start = getRangeStart(range, timeZone, nowMs);
  if (!start) return { start: null, previousStart: null };

  // The comparison period is as long as the elapsed part of the current one, so
  // "last 7 days" is compared against the equivalent stretch before it.
  return {
    start,
    previousStart: new Date(start.getTime() - (nowMs - start.getTime())),
  };
}

export function filterOrdersInWindow(
  orders: PlacedOrder[],
  window: AnalyticsWindow
): PlacedOrder[] {
  if (!window.start) return orders;
  const start = window.start.getTime();
  return orders.filter((order) => new Date(order.placedAt).getTime() >= start);
}

export function filterOrdersInPreviousWindow(
  orders: PlacedOrder[],
  window: AnalyticsWindow
): PlacedOrder[] {
  if (!window.start || !window.previousStart) return [];
  const start = window.start.getTime();
  const previousStart = window.previousStart.getTime();

  return orders.filter((order) => {
    const placedAt = new Date(order.placedAt).getTime();
    return placedAt >= previousStart && placedAt < start;
  });
}

export function filterOrdersByRange(
  orders: PlacedOrder[],
  range: ReportDateRange,
  timeZone: string = DEFAULT_TIME_ZONE
): PlacedOrder[] {
  return filterOrdersInWindow(orders, getAnalyticsWindow(range, timeZone));
}

export function filterOrdersByPreviousRange(
  orders: PlacedOrder[],
  range: ReportDateRange,
  timeZone: string = DEFAULT_TIME_ZONE
): PlacedOrder[] {
  return filterOrdersInPreviousWindow(orders, getAnalyticsWindow(range, timeZone));
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
  const revenue = countable.reduce((sum, order) => sum + keptRevenue(order), 0);
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
  range: ReportDateRange,
  timeZone: string = DEFAULT_TIME_ZONE,
  nowMs = Date.now()
): RevenueTrendPoint[] {
  const filtered = filterOrdersInWindow(
    orders,
    getAnalyticsWindow(range, timeZone, nowMs)
  );
  const useDaily = range === "7d" || range === "30d";
  const buckets = new Map<string, RevenueTrendPoint>();

  // Buckets and orders MUST be keyed the same way, and both keys come from the
  // viewer's calendar. Stepping by a fixed 24h would drift across a DST change
  // and put a day's orders on a key with no bucket; stepping by CALENDAR days in
  // the zone cannot.
  if (useDaily) {
    const days = range === "7d" ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const dayStart = zonedStartOfDay(nowMs, timeZone, -i);
      buckets.set(zonedDayKey(dayStart, timeZone), {
        label: new Date(dayStart).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          timeZone,
        }),
        revenue: 0,
        orders: 0,
      });
    }
  } else {
    // Seed from the month the window ACTUALLY starts in, through the current
    // one. A fixed count silently dropped orders: "90 days" reaches back 89 days
    // from viewer midnight, which routinely starts in a fourth calendar month,
    // and "all time" was given a flat twelve. Orders keyed to an unseeded month
    // hit no bucket and vanished from the chart while still counting in the
    // cards above it.
    const windowStart = getRangeStart(range, timeZone, nowMs);
    // Skip unparseable timestamps rather than letting them decide where the
    // chart starts. `zonedParts` maps invalid input to the epoch so it cannot
    // throw, which means ONE malformed placedAt would otherwise seed an
    // all-time chart from January 1970 — 679 monthly bars, with that order's
    // revenue filed under "Jan 70".
    const earliestMs =
      windowStart?.getTime() ??
      filtered.reduce((min, order) => {
        const placedAt = new Date(order.placedAt).getTime();
        return Number.isFinite(placedAt) ? Math.min(min, placedAt) : min;
      }, nowMs);

    const lastMonth = zonedStartOfMonth(nowMs, timeZone);
    const spansMultipleYears =
      zonedParts(earliestMs, timeZone).year !== zonedParts(nowMs, timeZone).year;

    for (let i = 0; ; i += 1) {
      const monthStart = zonedStartOfMonth(earliestMs, timeZone, i);
      if (monthStart > lastMonth) break;
      buckets.set(zonedMonthKey(monthStart, timeZone), {
        label: monthLabel(monthStart, timeZone, spansMultipleYears),
        revenue: 0,
        orders: 0,
      });
    }
  }

  for (const order of filtered) {
    const placedAt = new Date(order.placedAt).getTime();
    const key = useDaily
      ? zonedDayKey(placedAt, timeZone)
      : zonedMonthKey(placedAt, timeZone);

    const bucket = buckets.get(key);
    if (!bucket) continue;

    bucket.orders += 1;
    bucket.revenue += keptRevenue(order);
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
        revenue: matched.reduce((sum, order) => sum + keptRevenue(order), 0),
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
    current.revenue += keptRevenue(order);
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

export function getTopProducts(orders: PlacedOrder[], limit = 5): TopProductItem[] {
  const map = new Map<string, TopProductItem>();

  for (const order of orders.filter(isCountableRevenue)) {
    // A partial refund cannot be attributed to one line, so it is shared across
    // them in proportion to what each contributed. Without this, "top products
    // by revenue" stayed gross while every other figure on the screen went net,
    // and the two disagreed about the same orders.
    //
    // Only the REFUND is shared — not the order total, which carries delivery
    // and tax that were never a product's revenue. Scaling by
    // `keptRevenue / gross` inflated every unrefunded line by the delivery fee,
    // which the existing top-products test caught immediately.
    const gross = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const refunded = order.refundRecord?.amount ?? 0;
    const share = gross > 0 ? Math.max(0, 1 - refunded / gross) : 0;

    for (const item of order.items) {
      const current = map.get(item.productSlug) ?? {
        slug: item.productSlug,
        name: item.name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity * share;
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
    current.revenue += keptRevenue(order);
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
    current.revenue += keptRevenue(order);
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
