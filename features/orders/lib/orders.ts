import { migrateLegacyCartItem, type CartLineItem } from "@/features/cart/lib/cart";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";
import type { RefundReasonCode, RefundRecord } from "@/types/refund";
import type { AppliedCoupon } from "./coupons";
import type { CheckoutAddress, DeliverySlot, PaymentMethod } from "./checkout-draft";
import type { CartTotals } from "./cart-totals";
import {
  fetchOrder,
  placeOrderRequest,
  updateStatusRequest,
  cancelOrderRequest,
  refundOrderRequest,
  paymentStatusRequest,
  adminNotesRequest,
  refundNotesRequest,
  requestRefundRequest,
  type PlaceOrderResponse,
} from "./orders-api";

const ORDERS_STORAGE_KEY = "bakery-cms-orders";

export const ORDERS_UPDATED_EVENT = "bakery-orders-updated";

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
  /** The delivery window agreed at checkout, when one was chosen. */
  deliverySlot?: DeliverySlot;
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
  window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
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
  // A bare random 4-digit suffix collides often: 9,000 slots per day means a
  // ~43% chance of a duplicate after only 100 orders. A duplicate is not
  // cosmetic — getOrderByNumber() returns the first match, so the older order
  // becomes permanently unreachable and its owner sees a stranger's order.
  // Retry against the orders already on file, then fall back to a wider suffix.
  const existing = new Set(readOrders().map((order) => order.orderNumber));

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `${prefix}-${stamp}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }

  // Pathologically unlucky (or a very busy day) — widen the space instead of
  // handing back a number we know is taken.
  return `${prefix}-${stamp}-${Date.now().toString(36).toUpperCase()}`;
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
  totals: CartTotals,
  slot?: DeliverySlot
): string {
  // The slot chosen at checkout is the promise made to the customer, so it
  // takes precedence over dates picked per item on the product page.
  if (slot?.date) {
    const chosen = new Date(slot.date);
    if (!Number.isNaN(chosen.getTime())) return chosen.toISOString();
  }

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

/**
 * Two identical submissions this close together are a double-click, not two orders.
 *
 * This is a heuristic for accidental double-submits and NOTHING MORE. It must not
 * be relied on as the retry path's idempotency key: past the window `placeOrder`
 * mints a fresh id and order number, and since the endpoint dedupes on the id,
 * that is a second order — see [confirmOrder].
 */
const DUPLICATE_ORDER_WINDOW_MS = 15_000;

/**
 * crypto.randomUUID() only exists in secure contexts. Over plain HTTP on a LAN
 * address it is undefined, and placing an order would throw *after* payment had
 * already been captured.
 */
function newOrderId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `order-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildOrderFingerprint(input: {
  items: CartLineItem[];
  totals: CartTotals;
  address: CheckoutAddress;
  paymentMethod: PaymentMethod;
}): string {
  return JSON.stringify([
    input.address?.email ?? "",
    input.address?.phone ?? "",
    input.paymentMethod,
    input.totals?.total ?? 0,
    input.items.map((item) => [item.productSlug, item.quantity, item.price]),
  ]);
}

/**
 * The order, plus whether the SERVER has it.
 *
 * These come apart, and at checkout the difference is the whole ball game: the
 * local write is a cache, so an order the server never received exists only in
 * that one browser. The customer has paid, has a confirmation number, and can
 * even track it — against their own localStorage — while the bakery never sees
 * the order at all. Callers must not say "confirmed" on `order` alone.
 */
export interface PlaceOrderResult {
  order: PlacedOrder;
  persisted: boolean;
  /**
   * The shop is closed for maintenance, carrying the admin's own message.
   *
   * Distinct from a plain `persisted: false`, which means "we could not reach
   * the bakery" and is worth retrying. This one will be refused every time, so
   * the caller must say so instead of offering a retry that cannot work.
   */
  closed?: string;
}

/**
 * Re-send an order the server never acknowledged, identity intact.
 *
 * `placeOrder` cannot serve as the retry path. Its duplicate guard only
 * recognises a matching submission for DUPLICATE_ORDER_WINDOW_MS; past that it
 * mints a new id and order number, and because the endpoint keys idempotency on
 * the id, that is not a retry — it is a SECOND order with a second stock
 * decrement, for one payment. And the window lapses in the ordinary case: the
 * failure notice deliberately puts the payment reference in front of the customer
 * to write down, which is exactly the pause that outlasts fifteen seconds.
 *
 * So the retry sends the order it already has, byte for byte.
 */
export async function confirmOrder(order: PlacedOrder): Promise<PlaceOrderResult> {
  return adoptStoredOrder(order, await placeOrderRequest(order));
}

/**
 * Reconcile the local copy with what the server actually stored.
 *
 * The server owns order-number uniqueness, so the number it returns may not be
 * the one this browser proposed. Whatever it says is the number on the invoice,
 * in the admin list and on the tracking page, so the local cache has to agree —
 * otherwise the customer's confirmation matches no order in the bakery.
 */
function adoptStoredOrder(local: PlacedOrder, response: PlaceOrderResponse): PlaceOrderResult {
  if (!response.ok) return { order: local, persisted: false, closed: response.closed };

  const stored = response.order;
  if (!stored || stored.orderNumber === local.orderNumber) {
    return { order: local, persisted: true };
  }

  const orders = readOrders();
  const index = orders.findIndex((entry) => entry.id === local.id);
  if (index === -1) orders.unshift(stored);
  else orders[index] = stored;
  writeOrders(orders);

  return { order: stored, persisted: true };
}

export async function placeOrder(input: {
  items: CartLineItem[];
  totals: CartTotals;
  address: CheckoutAddress;
  paymentMethod: PaymentMethod;
  paymentStatus?: PaymentStatus;
  paymentReference?: string;
  coupon?: AppliedCoupon;
  orderNotes?: string;
  deliverySlot?: DeliverySlot;
}): Promise<PlaceOrderResult> {
  const placedAt = new Date().toISOString();
  const paymentStatus =
    input.paymentStatus ??
    (input.paymentMethod === "cod" ? "cod" : "paid");

  // Guard against a double-click (or a retry after a successful attempt)
  // creating a second order. The React `disabled` flag is not enough: it is set
  // inside the same handler, and COD waits ~800ms before committing.
  const fingerprint = buildOrderFingerprint(input);
  const recent = readOrders().find(
    (existing) =>
      buildOrderFingerprint(existing) === fingerprint &&
      Date.now() - new Date(existing.placedAt).getTime() < DUPLICATE_ORDER_WINDOW_MS
  );
  // Re-send rather than assume the first attempt reached the server: a customer
  // pressing the button again is often doing so BECAUSE it did not. The POST is
  // idempotent on the order id, so this cannot create a second order.
  if (recent) return adoptStoredOrder(recent, await placeOrderRequest(recent));

  const order: PlacedOrder = {
    id: newOrderId(),
    orderNumber: generateOrderNumber(),
    items: input.items,
    totals: input.totals,
    address: input.address,
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paymentReference: input.paymentReference,
    coupon: input.coupon,
    orderNotes: input.orderNotes,
    deliverySlot: input.deliverySlot,
    placedAt,
    status: "confirmed",
    statusHistory: [{ status: "confirmed", at: placedAt }],
    estimatedDelivery: resolveEstimatedDelivery(
      input.items,
      input.totals,
      input.deliverySlot
    ),
  };

  writeOrders([order, ...readOrders()]);
  // Durable write to the server (creates the order in Mongo + reduces stock,
  // atomically). Sends the same id/orderNumber so both copies agree.
  return adoptStoredOrder(order, await placeOrderRequest(order));
}

/**
 * Whether the one-shot server hydration has finished (successfully or not).
 *
 * The local cache starts empty, so without this an admin screen cannot tell
 * "this shop has no orders" from "the fetch is still in flight" — and would
 * show a definitive "No orders found" during every cold load.
 */
let ordersSyncSettled = false;

export function hasOrdersSyncSettled(): boolean {
  return ordersSyncSettled;
}

/** Called by the sync hook once the fetch resolves, whatever the outcome. */
export function markOrdersSyncSettled(): void {
  if (ordersSyncSettled) return;
  ordersSyncSettled = true;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ORDERS_UPDATED_EVENT));
  }
}

/** Hydration: replace the local order cache with the server's copy. */
export function persistServerOrders(orders: PlacedOrder[]): void {
  writeOrders(orders.map(normalizeOrder));
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

/**
 * The order a mutation applies to — from the local cache, or from the server
 * when the cache does not have it.
 *
 * The admin lists are server-paginated over every order, so an admin routinely
 * opens an order far older than the browser cache holds. Resolving against the
 * cache alone made every action on such an order a silent no-op: no change, no
 * toast, no error.
 */
async function resolveOrderForMutation(orderId: string): Promise<PlacedOrder | null> {
  return getOrderById(orderId) ?? (await fetchOrder(orderId));
}

/** Apply an order to the local cache, inserting it if it was not already there. */
/**
 * Applies `patch` to the FRESHEST copy of the order and writes it back.
 *
 * `resolveOrderForMutation` may await a server read, and a second mutation can
 * land in that window. Patching the copy read before the await would write a
 * whole order object built from stale fields — saving admin notes would quietly
 * revert a status change made a moment earlier. The patch is applied at write
 * time instead, so only the field each mutation owns is touched.
 *
 * `fallback` is used when the order still is not cached (it came from the
 * server), in which case there is nothing to conflict with.
 */
function commitOrder(
  orderId: string,
  fallback: PlacedOrder,
  patch: (order: PlacedOrder) => PlacedOrder
): PlacedOrder {
  const orders = readOrders();
  const index = orders.findIndex((order) => order.id === orderId);
  const updated = patch(index === -1 ? fallback : orders[index]);

  if (index === -1) orders.unshift(updated);
  else orders[index] = updated;

  writeOrders(orders);
  return updated;
}

/**
 * Outcome of an admin order mutation.
 *
 * `order` is the locally-updated copy (null when the id was unknown).
 * `persisted` is whether the SERVER accepted the change. These come apart more
 * often than you would think — an expired token 401s — and the difference
 * matters: the local write is a cache, so a change the server rejected is
 * silently reverted by the next hydration. Callers must not report success on
 * `order` alone.
 */
export interface OrderMutationResult {
  order: PlacedOrder | null;
  persisted: boolean;
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };

  const now = new Date().toISOString();
  const updated = commitOrder(orderId, current, (order) => ({
    ...order,
    status,
    statusHistory: [...order.statusHistory, { status, at: now }],
  }));

  return { order: updated, persisted: await updateStatusRequest(orderId, status) };
}

export async function updateOrderAdminNotes(
  orderId: string,
  adminNotes: string
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };

  const updated = commitOrder(orderId, current, (order) => ({
    ...order,
    adminNotes: adminNotes.trim() || undefined,
  }));

  return { order: updated, persisted: await adminNotesRequest(orderId, adminNotes) };
}

export async function updatePaymentStatus(
  orderId: string,
  paymentStatus: PaymentStatus,
  paymentReference?: string
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };
  // A refund is terminal — there is nothing left to change.
  if (current.status === "refunded" || current.paymentStatus === "refunded") {
    return { order: current, persisted: true };
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

  const committed = commitOrder(orderId, current, (order) => ({
    ...order,
    paymentStatus: updated.paymentStatus,
    paymentReference: updated.paymentReference,
  }));

  return {
    order: committed,
    persisted: await paymentStatusRequest(orderId, paymentStatus, committed.paymentReference),
  };
}

export async function bulkUpdatePaymentStatus(
  orderIds: string[],
  paymentStatus: PaymentStatus
): Promise<BulkOrderResult> {
  let updated = 0;
  let failed = 0;

  for (const orderId of orderIds) {
    const before = getOrderById(orderId);
    if (!before || before.paymentStatus === "refunded" || before.status === "refunded") {
      continue;
    }
    const result = await updatePaymentStatus(orderId, paymentStatus);
    if (result.order?.paymentStatus !== paymentStatus) continue;
    updated += 1;
    if (!result.persisted) failed += 1;
  }

  return { updated, failed };
}

export async function cancelOrder(
  orderId: string,
  cancellationReason?: string
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };
  if (current.status === "refunded") return { order: current, persisted: true };

  const now = new Date().toISOString();
  const updated: PlacedOrder = {
    ...current,
    status: "cancelled",
    cancellationReason: cancellationReason?.trim() || undefined,
    statusHistory: [...current.statusHistory, { status: "cancelled", at: now }],
  };

  const committed = commitOrder(orderId, current, (order) => ({
    ...order,
    status: "cancelled",
    cancellationReason: updated.cancellationReason,
    statusHistory: [...order.statusHistory, { status: "cancelled" as const, at: now }],
  }));

  return {
    order: committed,
    persisted: await cancelOrderRequest(orderId, cancellationReason),
  };
}

export async function refundOrder(
  orderId: string,
  input: RefundOrderInput = {}
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };

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

  const committed = commitOrder(orderId, current, (order) => ({
    ...order,
    status: "refunded" as const,
    paymentStatus: "refunded" as const,
    refundReference,
    refundRecord,
    statusHistory: [...order.statusHistory, { status: "refunded" as const, at: now }],
  }));

  return { order: committed, persisted: await refundOrderRequest(orderId, input) };
}

export async function updateRefundNotes(
  orderId: string,
  notes: string
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };
  if (!current.refundRecord) return { order: current, persisted: true };

  const committed = commitOrder(orderId, current, (order) => ({
    ...order,
    refundRecord: order.refundRecord
      ? { ...order.refundRecord, notes: notes.trim() || undefined }
      : order.refundRecord,
  }));

  return { order: committed, persisted: await refundNotesRequest(orderId, notes) };
}

export async function requestRefundForCancelledOrder(
  orderId: string,
  input: RefundOrderInput = {}
): Promise<OrderMutationResult> {
  const current = await resolveOrderForMutation(orderId);
  if (!current) return { order: null, persisted: false };
  if (current.status !== "cancelled" || current.refundRecord) {
    return { order: current, persisted: true };
  }

  const now = new Date().toISOString();
  const reason = input.reason ?? "order_cancelled";

  const refundRecord: RefundRecord = {
    status: "requested",
    reason,
    reasonDetail: input.reasonDetail?.trim() || undefined,
    amount: current.totals.total,
    notes: input.notes?.trim() || undefined,
    requestedAt: now,
    history: [{ status: "requested", at: now, note: "Refund requested" }],
  };

  const committed = commitOrder(orderId, current, (order) => ({
    ...order,
    refundRecord,
  }));

  return { order: committed, persisted: await requestRefundRequest(orderId, input) };
}

/** `updated` counts orders that actually changed; `failed` how many the server rejected. */
export interface BulkOrderResult {
  updated: number;
  failed: number;
}

export async function bulkUpdateOrderStatus(
  orderIds: string[],
  status: OrderStatus
): Promise<BulkOrderResult> {
  if (orderIds.length === 0) return { updated: 0, failed: 0 };

  const orders = readOrders();
  const now = new Date().toISOString();
  let touchedCache = false;

  // Optimistically update the rows the cache happens to hold. The cache covers
  // only the newest orders while the list is paginated over all of them, so this
  // is a nicety — the server request below is what actually matters, and it goes
  // out for EVERY selected id whether or not the cache knows about it.
  for (const orderId of orderIds) {
    const index = orders.findIndex((order) => order.id === orderId);
    if (index === -1) continue;

    const current = orders[index];
    if (current.status === status) continue;

    orders[index] = {
      ...current,
      status,
      statusHistory: [...current.statusHistory, { status, at: now }],
    };
    touchedCache = true;
  }

  // One write and one event for the whole batch. Going through
  // updateOrderStatus per id would re-read and re-write storage N times and
  // wake every subscriber (dashboard, sidebar, bell) on each one.
  if (touchedCache) writeOrders(orders);

  // Never skip an id because the LOCAL copy already shows the target status:
  // after a rejected batch that is true of every one of them, and skipping would
  // turn the admin's retry into a silent no-op.
  const results = await Promise.all(
    orderIds.map((orderId) => updateStatusRequest(orderId, status))
  );

  const failed = results.filter((persisted) => !persisted).length;
  return { updated: orderIds.length - failed, failed };
}

export function getLatestOrder(): PlacedOrder | null {
  return readOrders()[0] ?? null;
}
