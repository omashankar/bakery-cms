import type { PlacedOrder } from "@/features/orders/lib/orders";
import {
  DEFAULT_TIME_ZONE,
  zonedDayKey,
  zonedStartOfDay,
} from "@/features/orders/lib/viewer-time";
import {
  deriveTransactionStatus,
  isCollectedMoney,
} from "@/features/payments/lib/payment-status";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";

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
  /** Orders whose money arrived TODAY. The card subtitle used collectedOrders,
   *  which is the all-time count — so "today" showed a lifetime number. */
  todayCount: number;
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
  // Today has two edges. `>= startOfToday` alone was harmless while everything
  // was bucketed by `placedAt` (an order cannot be placed in the future), but
  // COD now buckets on its DELIVERY timestamp — and a scheduled or mis-entered
  // delivery date beyond today would otherwise land in "Today's collection".
  const startOfTomorrow = zonedStartOfDay(nowMs, timeZone, 1);
  const dayKey = (ms: number) => zonedDayKey(ms, timeZone);

  /**
   * When did this order's money actually ARRIVE?
   *
   * For an online payment that is when the order was placed. For COD it is
   * delivery day — the cash does not exist until the rider hands it over. Both
   * were bucketed by `placedAt`, so a COD order taken on Monday and delivered on
   * Friday put its cash into Monday: invisible in "Today's collection" on the
   * day it was actually collected, and in the wrong bar of the 7-day chart.
   */
  const collectedAtMs = (order: PlacedOrder): number => {
    if (order.paymentMethod === "cod") {
      const delivered = (order.statusHistory ?? []).find((e) => e.status === "delivered");
      if (delivered?.at) {
        const at = new Date(delivered.at).getTime();
        if (Number.isFinite(at)) return at;
      }
    }
    return new Date(order.placedAt).getTime();
  };

  let todayCollection = 0;
  let todayCount = 0;
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
    // Only money the gateway confirmed leaving. `refundRecord` alone used to be
    // enough, so a `requested` record — which `requestRefund` writes at the FULL
    // order total with no payment check at all — put the whole value of a
    // cancelled COD order into a card labelled as refunded money.
    const refunded = settledRefundAmount(order);

    if (refunded > 0) {
      refundCount += 1;
      refundAmount += refunded;
    }

    // Money that arrived stays counted as money that arrived, and a refund is
    // subtracted from it. Refunded orders used to drop out of `SUCCESS`
    // altogether, which removed the ENTIRE order total from collection — so a
    // ₹200 refund on a ₹5,000 order cost the collection figure ₹5,000 while the
    // refund card next to it reported ₹200.
    //
    // `cancelled` is included for the same reason: it is tested before
    // `paymentStatus`, so a paid order an admin cancels derived to "cancelled",
    // matched none of the branches below, and contributed to nothing at all —
    // not collection, not pending, not failed — while its money sat in the
    // gateway account. That is also the mandatory state before `requestRefund`.
    const collected = SUCCESS.has(status) || isCollectedMoney(order);

    if (collected) {
      const net = Math.max(0, amount - refunded);
      collectedOrders += 1;
      totalCollection += net;
      if (isOnline) onlineAmount += net;
      else offlineAmount += net;

      const arrivedAt = collectedAtMs(order);
      if (arrivedAt >= startOfToday && arrivedAt < startOfTomorrow) {
        todayCollection += net;
        todayCount += 1;
      }

      const key = dayKey(arrivedAt);
      if (dayBuckets.has(key)) dayBuckets.set(key, (dayBuckets.get(key) ?? 0) + net);

      const m = methodMap.get(order.paymentMethod) ?? { count: 0, amount: 0 };
      m.count += 1;
      m.amount += net;
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
  // Both sides over the same population. `refundCount` used to be counted over
  // every order with a refund record while `collectedOrders` excluded refunded
  // ones — two disjoint sets, so the ratio could exceed 100%.
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
    todayCount,
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
