import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
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
const DAY = 86_400_000;

function methodLabel(method: string): string {
  if (method === "cod") return "Cash on Delivery";
  return "Online (Razorpay)";
}

export function getPaymentAnalytics(orders: PlacedOrder[]): PaymentAnalytics {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

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

  // Seed 7-day buckets (oldest -> newest)
  const dayLabels: { key: string; label: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday - i * DAY);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    dayLabels.push({ key, label });
    dayBuckets.set(key, 0);
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

      const key = new Date(order.placedAt).toISOString().slice(0, 10);
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
