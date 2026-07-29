/**
 * Client-side orders API. The storefront dual-writes placed orders to the
 * server (so the admin, on another device, sees them); the admin dual-writes
 * lifecycle changes and hydrates the full list. Best-effort — never throws, so
 * the localStorage flow keeps working offline/unauthenticated.
 */
import type { OrderStatus, PaymentStatus, PlacedOrder, RefundOrderInput } from "./orders";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function send(path: string, method: string, body?: unknown): Promise<void> {
  try {
    await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // best-effort
  }
}

/** Send the fully-built order to the server (verbatim id/orderNumber). */
export function placeOrderRequest(order: PlacedOrder): void {
  void send("/api/orders", "POST", order);
}

export function updateStatusRequest(orderId: string, status: OrderStatus): void {
  void send(`/api/orders/${orderId}/status`, "PATCH", { status });
}

export function cancelOrderRequest(orderId: string, cancellationReason?: string): void {
  void send(`/api/orders/${orderId}/cancel`, "POST", { cancellationReason });
}

export function refundOrderRequest(orderId: string, input: RefundOrderInput): void {
  void send(`/api/orders/${orderId}/refund`, "POST", input);
}

export function paymentStatusRequest(
  orderId: string,
  paymentStatus: PaymentStatus,
  paymentReference?: string,
): void {
  void send(`/api/orders/${orderId}/payment`, "PATCH", { paymentStatus, paymentReference });
}

export function adminNotesRequest(orderId: string, adminNotes: string): void {
  void send(`/api/orders/${orderId}/notes`, "PATCH", { adminNotes });
}

export function refundNotesRequest(orderId: string, notes: string): void {
  void send(`/api/orders/${orderId}/refund-notes`, "PATCH", { notes });
}

export function requestRefundRequest(orderId: string, input: RefundOrderInput): void {
  void send(`/api/orders/${orderId}/refund-request`, "POST", input);
}

/** Admin: fetch all orders from the server (401 → null for non-admins). */
export async function fetchOrders(): Promise<PlacedOrder[] | null> {
  try {
    const res = await fetch("/api/orders", { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<PlacedOrder[]>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/**
 * Admin: fetch a single order from the server by id. Used as a cache-miss
 * fallback so a deep link (or an order placed on another device) resolves from
 * the backend instead of flashing "Order not found" before the list hydrates.
 */
export async function fetchOrder(orderId: string): Promise<PlacedOrder | null> {
  try {
    const res = await fetch(`/api/orders/${orderId}`, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const json = (await res.json()) as Envelope<PlacedOrder>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
