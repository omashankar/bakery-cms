import { migrateLegacyCartItem, type CartLineItem } from "@/features/cart/lib/cart";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { RefundReasonCode, RefundRecord } from "@/types/refund";
import type { AppliedCoupon } from "./coupons";
import type { CheckoutAddress, PaymentMethod } from "./checkout-draft";
import type { CartTotals } from "./cart-totals";

const ORDERS_STORAGE_KEY = "bakery-cms-orders";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refunded";

export type PaymentStatus = "cod" | "paid" | "pending" | "failed" | "refunded";

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
  items: CartLineItem[];
  totals: CartTotals;
  address: CheckoutAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  coupon?: AppliedCoupon;
  orderNotes?: string;
  placedAt: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  estimatedDelivery: string;
  adminNotes?: string;
  cancellationReason?: string;
  refundReference?: string;
  refundRecord?: RefundRecord;
}

export interface RefundOrderInput {
  reason?: RefundReasonCode;
  reasonDetail?: string;
  notes?: string;
  /** Partial refund amount. Omitted or >= total means a full refund. */
  amount?: number;
}

function normalizeOrder(order: PlacedOrder): PlacedOrder {
  return {
    ...order,
    // Order history predating the cakeSlug -> productSlug rename still stores the
    // old key; upgrade it so past orders keep resolving to their products.
    items: order.items?.map((item) => migrateLegacyCartItem(item)) ?? order.items,
    paymentStatus: order.paymentStatus ?? (order.paymentMethod === "cod" ? "cod" : "paid"),
    statusHistory:
      order.statusHistory?.length > 0
        ? order.statusHistory
        : [{ status: order.status ?? "confirmed", at: order.placedAt }],
  };
}

function readOrders(): PlacedOrder[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlacedOrder[];
    return Array.isArray(parsed) ? parsed.map(normalizeOrder) : [];
  } catch {
    return [];
  }
}

function writeOrders(orders: PlacedOrder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("bakery-orders-updated"));
}

function getCommerceConfig() {
  if (typeof window === "undefined") return defaultCommerceSettings;
  return getCommerceSettings();
}

function generateOrderNumber(): string {
  const commerce = getCommerceConfig();
  const prefix = commerce.orderNumberPrefix.trim() || "BK";
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = String(Math.floor(Math.random() * 9000) + 1000);
  return `${prefix}-${stamp}-${suffix}`;
}

function getEstimatedDelivery(): string {
  const days = getCommerceConfig().estimatedDeliveryDays;
  const date = new Date();
  date.setDate(date.getDate() + Math.max(days, 0));
  return date.toISOString();
}

function parseCartDeliveryDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

function resolveEstimatedDelivery(
  items: CartLineItem[],
  totals: CartTotals
): string {
  const scheduled = items
    .map((item) => (item.deliveryDate ? parseCartDeliveryDate(item.deliveryDate) : null))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  if (scheduled[0]) {
    return scheduled[0].toISOString();
  }

  if (typeof totals.estimatedDeliveryDays === "number") {
    const date = new Date();
    date.setDate(date.getDate() + Math.max(totals.estimatedDeliveryDays, 0));
    return date.toISOString();
  }

  return getEstimatedDelivery();
}

export function placeOrder(input: {
  items: CartLineItem[];
  totals: CartTotals;
  address: CheckoutAddress;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  coupon?: AppliedCoupon;
  orderNotes?: string;
}): PlacedOrder {
  const placedAt = new Date().toISOString();
  const paymentStatus =
    input.paymentStatus ??
    (input.paymentMethod === "cod" ? "cod" : "paid");

  const order: PlacedOrder = {
    id: crypto.randomUUID(),
    orderNumber: generateOrderNumber(),
    items: input.items,
    totals: input.totals,
    address: input.address,
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paymentReference: input.paymentReference,
    coupon: input.coupon,
    orderNotes: input.orderNotes,
    placedAt,
    status: "confirmed",
    statusHistory: [{ status: "confirmed", at: placedAt }],
    estimatedDelivery: resolveEstimatedDelivery(input.items, input.totals),
  };

  writeOrders([order, ...readOrders()]);
  return order;
}

export function getOrdersForCustomer(email: string): PlacedOrder[] {
  const normalized = email.trim().toLowerCase();
  // Guard against malformed/legacy orders missing an address — one bad record
  // must not crash the whole account dashboard.
  return readOrders().filter(
    (order) => order.address?.email?.toLowerCase() === normalized
  );
}

export function getOrders(): PlacedOrder[] {
  return readOrders();
}

export function getOrderByNumber(orderNumber: string): PlacedOrder | null {
  return readOrders().find((order) => order.orderNumber === orderNumber) ?? null;
}

export function getOrderById(id: string): PlacedOrder | null {
  return readOrders().find((order) => order.id === id) ?? null;
}

export function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const current = orders[index];
  if (current.status === status) return current;

  const now = new Date().toISOString();
  const updated: PlacedOrder = {
    ...current,
    status,
    statusHistory: [...current.statusHistory, { status, at: now }],
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function updateOrderAdminNotes(
  orderId: string,
  adminNotes: string
): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const updated: PlacedOrder = {
    ...orders[index],
    adminNotes: adminNotes.trim() || undefined,
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  paymentReference?: string
): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const current = orders[index];
  if (current.status === "refunded" || current.paymentStatus === "refunded") {
    return current;
  }

  const updated: PlacedOrder = {
    ...current,
    paymentStatus,
    paymentReference:
      paymentReference?.trim() ||
      current.paymentReference ||
      (paymentStatus === "paid"
        ? `MANUAL-${current.orderNumber.slice(-6).toUpperCase()}`
        : current.paymentReference),
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function bulkUpdatePaymentStatus(
  orderIds: string[],
  paymentStatus: PaymentStatus
): number {
  let count = 0;
  for (const orderId of orderIds) {
    const before = getOrderById(orderId);
    if (!before || before.paymentStatus === "refunded" || before.status === "refunded") {
      continue;
    }
    const updated = updatePaymentStatus(orderId, paymentStatus);
    if (updated && updated.paymentStatus === paymentStatus) count += 1;
  }
  return count;
}

export function cancelOrder(
  orderId: string,
  cancellationReason?: string
): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const current = orders[index];
  if (current.status === "cancelled" || current.status === "refunded") return current;

  const now = new Date().toISOString();
  const updated: PlacedOrder = {
    ...current,
    status: "cancelled",
    cancellationReason: cancellationReason?.trim() || undefined,
    statusHistory: [...current.statusHistory, { status: "cancelled", at: now }],
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function refundOrder(
  orderId: string,
  input: RefundOrderInput = {}
): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const current = orders[index];
  if (current.status === "refunded") return current;

  const now = new Date().toISOString();
  const refundReference = `REF-${current.orderNumber.replace(/^BK-/, "")}`;
  const reason = input.reason ?? "customer_request";

  // Partial when a valid amount below the order total is supplied; else full.
  const orderTotal = current.totals.total;
  const requested = Number.isFinite(input.amount) ? Number(input.amount) : orderTotal;
  const refundAmount = Math.min(Math.max(0, requested), orderTotal);
  const isPartial = refundAmount < orderTotal;

  const refundRecord: RefundRecord = {
    status: "completed",
    reason,
    reasonDetail: input.reasonDetail?.trim() || undefined,
    amount: refundAmount,
    reference: refundReference,
    notes: input.notes?.trim() || undefined,
    requestedAt: current.refundRecord?.requestedAt ?? now,
    completedAt: now,
    history: [
      ...(current.refundRecord?.history ?? []),
      { status: "processing", at: now, note: "Refund initiated" },
      {
        status: "completed",
        at: now,
        note:
          input.notes?.trim() ||
          `${isPartial ? "Partial" : "Full"} refund completed`,
      },
    ],
  };

  const updated: PlacedOrder = {
    ...current,
    status: "refunded",
    paymentStatus: "refunded",
    refundReference,
    refundRecord,
    statusHistory: [...current.statusHistory, { status: "refunded", at: now }],
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function updateRefundNotes(orderId: string, notes: string): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const current = orders[index];
  if (!current.refundRecord) return current;

  const updated: PlacedOrder = {
    ...current,
    refundRecord: {
      ...current.refundRecord,
      notes: notes.trim() || undefined,
    },
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function requestRefundForCancelledOrder(
  orderId: string,
  input: RefundOrderInput = {}
): PlacedOrder | null {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  if (index === -1) return null;

  const current = orders[index];
  if (current.status !== "cancelled" || current.refundRecord) return current;

  const now = new Date().toISOString();
  const reason = input.reason ?? "order_cancelled";

  const updated: PlacedOrder = {
    ...current,
    refundRecord: {
      status: "requested",
      reason,
      reasonDetail: input.reasonDetail?.trim() || undefined,
      amount: current.totals.total,
      notes: input.notes?.trim() || undefined,
      requestedAt: now,
      history: [{ status: "requested", at: now, note: "Refund requested" }],
    },
  };

  orders[index] = updated;
  writeOrders(orders);
  return updated;
}

export function bulkUpdateOrderStatus(
  orderIds: string[],
  status: OrderStatus
): number {
  let count = 0;

  for (const orderId of orderIds) {
    const updated = updateOrderStatus(orderId, status);
    if (updated) count += 1;
  }

  return count;
}

export function getLatestOrder(): PlacedOrder | null {
  return readOrders()[0] ?? null;
}
