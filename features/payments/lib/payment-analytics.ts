import type { PlacedOrder } from "@/features/orders/lib/orders";
import {
  DEFAULT_TIME_ZONE,
  zonedDayKey,
  zonedStartOfDay,
} from "@/features/orders/lib/viewer-time";
import { deriveTransactionStatus } from "@/features/payments/lib/payment-status";

/**
 * Payment analytics computed from orders (frontend only — no backend).
 * "Collection" = money actually received (captured online + delivered COD).
 */

export interface MethodSlice {
  id: string;
  label: string;
  count: number;
  amount: number;
  pct: number;
}

export interface RevenuePoint {
  label: string;
  amount: number;
}

export interface PaymentAnalytics {
  todayCollection: number;
  totalCollection: number;
  onlineAmount: number;
  offlineAmount: number;
  pendingCount: number;
  pendingAmount: number;
  failedCount: number;
  refundCount: number;
  refundAmount: number;
  collectedOrders: number;
  aov: number;
  successRate: number;
  refundRate: number;
  methodBreakdown: MethodSlice[];
  revenueSeries: RevenuePoint[];
  topMethodLabel: string;
}

const SUCCESS = new Set(["captured", "paid", "cod_paid"]);

function methodLabel(method: string): string {
  if (method === "cod") return "Cash on Delivery";
  return "Online (Razorpay)";
}

/**
 * @param timeZone the VIEWER's IANA zone (Asia/Kolkata).
 *   This runs on the server, so "today" and the daily buckets must follow the
 *   admin's calendar; reading the environment's zone here would make them
 *   follow the server's. A numeric offset would not do: a DST zone has two,
 *   and one of them is wrong for part of the week.
 */
export function getPaymentAnalytics(
  orders: PlacedOrder[],
  timeZone: string = DEFAULT_TIME_ZONE,
  nowMs = Date.now(),
): PaymentAnalytics {
  // Day boundaries come from the viewer's calendar, per instant — a constant
  // offset would put the far side of a DST change in the wrong bucket.
  const startOfToday = zonedStartOfDay(nowMs, timeZone);
  const dayKey = (ms: number) => zonedDayKey(ms, timeZone);

  let todayCollection = 0;
  let totalCollection = 0;
  let onlineAmount = 0;
  let offlineAmount = 0;
  let pendingCount = 0;
  let pendingAmount = 0;
  let failedCount = 0;
  let refundCount = 0;
  let refundAmount = 0;
  let collectedOrders = 0;

  const methodMap = new Map<string, { count: number; amount: number }>();
  const dayBuckets = new Map<string, number>();

  // Seed 7-day buckets (oldest -> newest), keyed exactly as orders are keyed.
  // Stepping by CALENDAR days rather than a fixed 24h: across a DST change the
  // two drift apart and a whole day lands on a key with no bucket.
  const dayLabels: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = zonedStartOfDay(nowMs, timeZone, -i);
    dayLabels.push({
      key: dayKey(dayStart),
      label: new Date(dayStart).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone,
      }),
    });
    dayBuckets.set(dayKey(dayStart), 0);
  }

  for (const order of orders) {
    const status = deriveTransactionStatus(order);
    const amount = order.totals.total;
    const isOnline = order.paymentMethod !== "cod";

    if (order.refundRecord) {
      refundCount += 1;
      refundAmount += order.refundRecord.amount;
    }

    if (SUCCESS.has(status)) {
      collectedOrders += 1;
      totalCollection += amount;
      if (isOnline) onlineAmount += amount;
      else offlineAmount += amount;

      const placed = new Date(order.placedAt).getTime();
      if (placed >= startOfToday) todayCollection += amount;

      const key = dayKey(placed);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + amount);

      const m = methodMap.get(order.paymentMethod) ?? { count: 0, amount: 0 };
      m.count += 1;
      m.amount += amount;
      methodMap.set(order.paymentMethod, m);
    } else if (status === "pending" || status === "cod_pending") {
      pendingCount += 1;
      pendingAmount += amount;
    } else if (status === "failed") {
      failedCount += 1;
    }
  }

  const decided = collectedOrders + failedCount;
  const successRate = decided > 0 ? Math.round((collectedOrders / decided) * 100) : 100;
  const refundRate =
    collectedOrders > 0 ? Math.round((refundCount / collectedOrders) * 100) : 0;
  const aov = collectedOrders > 0 ? Math.round(totalCollection / collectedOrders) : 0;

  const methodBreakdown: MethodSlice[] = [...methodMap.entries()]
    .map(([id, v]) => ({
      id,
      label: methodLabel(id === "upi" || id === "card" ? "razorpay" : id),
      count: v.count,
      amount: v.amount,
      pct: totalCollection > 0 ? Math.round((v.amount / totalCollection) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const revenueSeries: RevenuePoint[] = dayLabels.map((d) => ({
    label: d.label,
    amount: dayBuckets.get(d.key) ?? 0,
  }));

  return {
    todayCollection,
    totalCollection,
    onlineAmount,
    offlineAmount,
    pendingCount,
    pendingAmount,
    failedCount,
    refundCount,
    refundAmount,
    collectedOrders,
    aov,
    successRate,
    refundRate,
    methodBreakdown,
    revenueSeries,
    topMethodLabel: methodBreakdown[0]?.label ?? "—",
  };
}
