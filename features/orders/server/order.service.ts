import { randomUUID } from "node:crypto";

import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { getSettings } from "@/features/settings/server/settings.service";
import * as productRepo from "@/features/products/server/product.repository";
import { deriveStockStatus } from "@/apps/admin/commerce/lib/inventory-utils";
import type { CommerceSettings } from "@/types/settings";
import type { RefundRecord } from "@/types/refund";
import type { PlacedOrder, OrderStatus, PaymentStatus } from "@/features/orders/lib/orders";

import * as repo from "./order.repository";
import type {
  PlaceOrderInput,
  RefundInput,
  RefundNotesInput,
  RefundRequestInput,
} from "./order.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

// ---- Order number + estimated delivery ------------------------------------

async function generateOrderNumber(commerce: CommerceSettings): Promise<string> {
  const prefix = commerce.orderNumberPrefix?.trim() || "BK";
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `${prefix}-${stamp}-${suffix}`;
    if (!(await repo.orderNumberExists(candidate))) return candidate;
  }
  return `${prefix}-${stamp}-${Date.now().toString(36).toUpperCase()}`;
}

function resolveEstimatedDelivery(
  input: PlaceOrderInput,
  commerce: CommerceSettings,
): string {
  const slotDate = input.deliverySlot?.date;
  if (slotDate) {
    const chosen = new Date(slotDate);
    if (!Number.isNaN(chosen.getTime())) return chosen.toISOString();
  }
  const days =
    typeof input.totals.estimatedDeliveryDays === "number"
      ? input.totals.estimatedDeliveryDays
      : commerce.estimatedDeliveryDays;
  const date = new Date();
  date.setDate(date.getDate() + Math.max(days ?? 1, 0));
  return date.toISOString();
}

// ---- Place order (transactional) ------------------------------------------

export async function placeOrder(input: PlaceOrderInput, ctx: RequestCtx): Promise<PlacedOrder> {
  // ONE PAYMENT, ONE ORDER — checked before anything is built.
  //
  // The id-based idempotency below only catches a retry that kept its id. This
  // catches the cases that cannot: a client that lost its local copy and
  // re-submitted, a reload followed by a fresh checkout of the same cart, or a
  // retry path that minted a new id. A captured payment reference identifies the
  // money, and the money is what must not be charged for twice.
  if (input.paymentReference) {
    const existing = await repo.findByPaymentReference(input.paymentReference);
    if (existing) return existing;
  }

  const settings = (await getSettings()) as Record<string, unknown>;
  const commerce = (settings.commerce ?? {}) as CommerceSettings;
  const placedAt = input.placedAt ?? new Date().toISOString();
  const paymentStatus: PaymentStatus =
    (input.paymentStatus as PaymentStatus | undefined) ??
    (input.paymentMethod === "cod" ? "cod" : "paid");

  const status = (input.status as OrderStatus | undefined) ?? "confirmed";
  const order: PlacedOrder = {
    // Use the client-provided identity/state when present (storefront), else
    // generate (direct API). Keeps local and server copies in agreement.
    id: input.id ?? randomUUID(),
    orderNumber: input.orderNumber ?? (await generateOrderNumber(commerce)),
    items: input.items as unknown as PlacedOrder["items"],
    totals: input.totals as unknown as PlacedOrder["totals"],
    address: input.address as unknown as PlacedOrder["address"],
    paymentMethod: input.paymentMethod,
    paymentStatus,
    paymentReference: input.paymentReference,
    coupon: input.coupon as unknown as PlacedOrder["coupon"],
    orderNotes: input.orderNotes,
    deliverySlot: input.deliverySlot as unknown as PlacedOrder["deliverySlot"],
    placedAt,
    status,
    statusHistory:
      (input.statusHistory as PlacedOrder["statusHistory"] | undefined) ?? [
        { status, at: placedAt },
      ],
    estimatedDelivery: input.estimatedDelivery ?? resolveEstimatedDelivery(input, commerce),
  };

  // Atomic: create the order AND reduce stock for each line together.
  //
  // Idempotent on the client-supplied id. The storefront retries this POST —
  // by the time it runs the customer's card has already been charged, so one
  // dropped response must not be the end of it — and a retry must not produce a
  // second order or decrement stock twice.
  const { order: saved, created } = await repo.createOrderWithStockReduction(
    order,
    input.items.map((item) => ({ slug: item.productSlug, quantity: item.quantity })),
  );

  // Nothing changed, so there is nothing to refresh and nothing new to record.
  // A second audit entry would read as a second order.
  if (!created) return saved;

  // Best-effort: refresh each affected product's derived stockStatus (the $inc
  // changed the quantity but not the status field). Not part of the transaction.
  await refreshStockStatuses(input.items.map((i) => i.productSlug));

  await writeAuditLog({
    action: "order.place",
    actorEmail: input.address.email,
    target: { type: "order", id: order.id },
    metadata: { orderNumber: order.orderNumber, total: input.totals.total, method: input.paymentMethod },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return order;
}

async function refreshStockStatuses(slugs: string[]): Promise<void> {
  const unique = [...new Set(slugs)];
  await Promise.all(
    unique.map(async (slug) => {
      try {
        const product = await productRepo.findBySlug(slug);
        if (!product || product.unlimitedStock) return;
        const stockStatus = deriveStockStatus({
          stockQuantity: product.stockQuantity,
          unlimitedStock: false,
          lowStockThreshold: product.lowStockThreshold,
        });
        if (stockStatus !== product.stockStatus) {
          await productRepo.patchFields(product.id, { stockStatus });
        }
      } catch {
        // A stock-status refresh failure must not fail the order.
      }
    }),
  );
}

// ---- Reads ----------------------------------------------------------------

/** Filtered + paginated page for the admin order list. */
export function getOrdersPage(query: repo.OrderListQuery) {
  return repo.list(query);
}

/**
 * Counts and revenue across every order, aggregated in Mongo.
 *
 * Kept separate from the list so the admin's totals stay correct no matter how
 * few rows the current page happens to carry.
 */
export function getStats() {
  return repo.stats();
}
export function getById(id: string) {
  return repo.findById(id);
}
export function getByNumber(orderNumber: string) {
  return repo.findByNumber(orderNumber);
}
export function getByCustomer(email: string) {
  return repo.findByCustomerEmail(email);
}

// ---- Lifecycle mutations --------------------------------------------------

async function requireOrder(id: string): Promise<PlacedOrder> {
  const order = await repo.findById(id);
  if (!order) throw new NotFoundError("Order not found");
  return order;
}

export async function updateStatus(id: string, status: OrderStatus, ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (order.status === status) return order;

  const now = new Date().toISOString();
  const updated = await repo.patch(id, {
    status,
    statusHistory: [...order.statusHistory, { status, at: now }],
  });
  await audit(ctx, "order.status", id, { status });
  return updated;
}

export async function cancel(id: string, cancellationReason: string | undefined, ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (order.status === "cancelled" || order.status === "refunded") return order;

  const now = new Date().toISOString();
  const updated = await repo.patch(id, {
    status: "cancelled",
    cancellationReason: cancellationReason?.trim() || undefined,
    statusHistory: [...order.statusHistory, { status: "cancelled", at: now }],
  });
  await audit(ctx, "order.cancel", id, { reason: cancellationReason });
  return updated;
}

export async function updatePayment(
  id: string,
  paymentStatus: PaymentStatus,
  paymentReference: string | undefined,
  ctx: RequestCtx,
) {
  const order = await requireOrder(id);
  if (order.status === "refunded" || order.paymentStatus === "refunded") return order;

  const updated = await repo.patch(id, {
    paymentStatus,
    paymentReference:
      paymentReference?.trim() ||
      order.paymentReference ||
      (paymentStatus === "paid"
        ? `MANUAL-${order.orderNumber.slice(-6).toUpperCase()}`
        : order.paymentReference),
  });
  await audit(ctx, "order.payment", id, { paymentStatus });
  return updated;
}

export async function updateAdminNotes(id: string, adminNotes: string, ctx: RequestCtx) {
  await requireOrder(id);
  const updated = await repo.patch(id, { adminNotes: adminNotes.trim() || undefined });
  await audit(ctx, "order.notes", id);
  return updated;
}

export async function refund(id: string, input: RefundInput, ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (order.status === "refunded") return order;

  const now = new Date().toISOString();
  const refundReference = `REF-${order.orderNumber.replace(/^BK-/, "")}`;
  const orderTotal = order.totals.total;
  const requested = Number.isFinite(input.amount) ? Number(input.amount) : orderTotal;
  const refundAmount = Math.min(Math.max(0, requested), orderTotal);
  const isPartial = refundAmount < orderTotal;

  const refundRecord: RefundRecord = {
    status: "completed",
    reason: (input.reason as RefundRecord["reason"]) ?? "customer_request",
    reasonDetail: input.reasonDetail?.trim() || undefined,
    amount: refundAmount,
    reference: refundReference,
    notes: input.notes?.trim() || undefined,
    requestedAt: order.refundRecord?.requestedAt ?? now,
    completedAt: now,
    history: [
      ...(order.refundRecord?.history ?? []),
      { status: "processing", at: now, note: "Refund initiated" },
      { status: "completed", at: now, note: input.notes?.trim() || `${isPartial ? "Partial" : "Full"} refund completed` },
    ],
  };

  const updated = await repo.patch(id, {
    status: "refunded",
    paymentStatus: "refunded",
    refundReference,
    refundRecord,
    statusHistory: [...order.statusHistory, { status: "refunded", at: now }],
  });
  await audit(ctx, "order.refund", id, { amount: refundAmount });
  return updated;
}

export async function updateRefundNotes(id: string, notes: RefundNotesInput["notes"], ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (!order.refundRecord) return order;

  const updated = await repo.patch(id, {
    refundRecord: {
      ...order.refundRecord,
      notes: notes.trim() || undefined,
    },
  });
  await audit(ctx, "order.refund.notes", id);
  return updated;
}

export async function requestRefund(id: string, input: RefundRequestInput, ctx: RequestCtx) {
  const order = await requireOrder(id);
  if (order.status !== "cancelled" || order.refundRecord) return order;

  const now = new Date().toISOString();
  const reason = (input.reason as RefundRecord["reason"]) ?? "order_cancelled";

  const refundRecord: RefundRecord = {
    status: "requested",
    reason,
    reasonDetail: input.reasonDetail?.trim() || undefined,
    amount: order.totals.total,
    notes: input.notes?.trim() || undefined,
    requestedAt: now,
    history: [{ status: "requested", at: now, note: "Refund requested" }],
  };

  const updated = await repo.patch(id, { refundRecord });
  await audit(ctx, "order.refund.request", id, { amount: refundRecord.amount });
  return updated;
}

function audit(ctx: RequestCtx, action: string, orderId: string, metadata?: Record<string, unknown>) {
  return writeAuditLog({
    action,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "order", id: orderId },
    metadata,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}
