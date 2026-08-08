import { downloadCsv, toCsv } from "@/utils/csv";
import type { OrderStatus, PaymentStatus, PlacedOrder } from "@/features/orders/lib/orders";

export type OrderStatusFilter = OrderStatus | "all";
export type PaymentStatusFilter = PaymentStatus | "all";

export type OrderDateRange = "all" | "7d" | "30d" | "90d";
export type OrderDeliveryFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "in_transit"
  | "delivered";

export interface OrderListFilters {
  search: string;
  status: OrderStatusFilter;
  payment: PaymentStatusFilter;
  dateRange: OrderDateRange;
  deliveryStatus: OrderDeliveryFilter;
  amountMin: string;
  amountMax: string;
}

export const defaultOrderFilters: OrderListFilters = {
  search: "",
  status: "all",
  payment: "all",
  dateRange: "all",
  deliveryStatus: "all",
  amountMin: "",
  amountMax: "",
};

function matchesDeliveryFilter(status: OrderStatus, filter: OrderDeliveryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") {
    return ["pending", "confirmed", "preparing", "ready"].includes(status);
  }
  if (filter === "in_progress") {
    return ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(
      status
    );
  }
  if (filter === "in_transit") return status === "out_for_delivery";
  return status === "delivered";
}

function matchesDateRange(placedAt: string, range: OrderDateRange): boolean {
  if (range === "all") return true;
  const placed = new Date(placedAt).getTime();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return placed >= cutoff;
}

export function countActiveOrderFilters(filters: OrderListFilters): number {
  let count = 0;
  if (filters.deliveryStatus !== "all") count += 1;
  if (filters.amountMin.trim()) count += 1;
  if (filters.amountMax.trim()) count += 1;
  return count;
}

export function filterOrders(
  orders: PlacedOrder[],
  filters: OrderListFilters
): PlacedOrder[] {
  const search = filters.search.trim().toLowerCase();
  const minAmount = filters.amountMin.trim() ? Number(filters.amountMin) : null;
  const maxAmount = filters.amountMax.trim() ? Number(filters.amountMax) : null;

  return orders.filter((order) => {
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (filters.payment !== "all" && order.paymentStatus !== filters.payment) return false;
    if (!matchesDateRange(order.placedAt, filters.dateRange)) return false;
    if (!matchesDeliveryFilter(order.status, filters.deliveryStatus)) return false;
    if (minAmount !== null && !Number.isNaN(minAmount) && order.totals.total < minAmount) {
      return false;
    }
    if (maxAmount !== null && !Number.isNaN(maxAmount) && order.totals.total > maxAmount) {
      return false;
    }

    if (!search) return true;

    const haystack = [
      order.orderNumber,
      order.address.fullName,
      order.address.email,
      order.address.phone,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function countOrdersByStatus(
  orders: PlacedOrder[],
  status: OrderStatus
): number {
  return orders.filter((order) => order.status === status).length;
}

export function getOrderStats(orders: PlacedOrder[]) {
  const revenue = orders
    .filter((order) => order.status !== "cancelled" && order.status !== "refunded")
    .reduce((sum, order) => sum + order.totals.total, 0);

  return {
    total: orders.length,
    pending: countOrdersByStatus(orders, "pending"),
    confirmed: countOrdersByStatus(orders, "confirmed"),
    preparing: countOrdersByStatus(orders, "preparing"),
    ready: countOrdersByStatus(orders, "ready"),
    outForDelivery: countOrdersByStatus(orders, "out_for_delivery"),
    delivered: countOrdersByStatus(orders, "delivered"),
    cancelled: countOrdersByStatus(orders, "cancelled"),
    refunded: countOrdersByStatus(orders, "refunded"),
    revenue,
  };
}

export function exportOrdersToCsv(orders: PlacedOrder[]): void {
  if (typeof window === "undefined" || orders.length === 0) return;

  const headers = [
    "Order Number",
    "Customer",
    "Email",
    "Phone",
    "Items",
    "Total",
    "Status",
    "Payment",
    "Placed At",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.address.fullName,
    order.address.email,
    order.address.phone,
    String(order.items.length),
    String(order.totals.total),
    order.status,
    order.paymentStatus,
    order.placedAt,
  ]);

  const csv = toCsv([headers, ...rows]);

  downloadCsv(`bakery-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
