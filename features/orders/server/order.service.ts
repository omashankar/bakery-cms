import { randomUUID } from "node:crypto";

import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { getSettings } from "@/features/settings/server/settings.service";
import * as productRepo from "@/features/products/server/product.repository";
import { deriveStockStatus } from "@/apps/admin/commerce/lib/inventory-utils";
import type { CommerceSettings, GeneralSettings } from "@/types/settings";
import type { RefundRecord } from "@/types/refund";
import { verifyOrderLookup } from "@/features/orders/lib/order-tracking";
import {
  publicBaseUrl,
  sendTemplatedEmail,
} from "@/features/communications/server/email.service";
import { routes } from "@/constants/routes";
import { formatCurrency } from "@/utils/format";
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

/** Fresh order numbers to try when the client's collided with another customer's. */
const ORDER_NUMBER_ATTEMPTS = 5;

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
  // Passed explicitly to `formatCurrency` below: this runs in a route handler,
  // which never renders the root layout, so there is no `<html>` and no
  // per-request locale for the formatter to fall back on.
  const currency = ((settings.general ?? {}) as GeneralSettings).currency;
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
  const reductions = input.items.map((item) => ({
    slug: item.productSlug,
    quantity: item.quantity,
  }));

  let candidate = order;
  let placed: PlacedOrder | null = null;

  // The loop exists for orderNumber collisions only. The storefront picks its
  // own number, de-duplicated against that browser's orders alone, so two
  // customers clash regularly. The server owns uniqueness: mint a fresh number
  // and insert again. Bounded because each attempt is a real round trip, and
  // generateOrderNumber already checks the collection.
  for (let attempt = 0; attempt < ORDER_NUMBER_ATTEMPTS && !placed; attempt += 1) {
    const outcome = await repo.createOrderWithStockReduction(candidate, reductions);

    if (outcome.kind === "already-placed") {
      // This endpoint is deliberately unauthenticated — it is the storefront
      // checkout. That makes the idempotent branch a read of stored data keyed
      // on a guessable id, so it must not hand back a stranger's record: name,
      // phone, street address, every line item. A genuine retry always carries
      // the same contact details it was placed with, so requiring them costs
      // nothing and closes the oracle.
      if (!verifyOrderLookup(outcome.order, input.address)) {
        throw new NotFoundError("Order not found");
      }

      // Nothing changed, so there is nothing to refresh and nothing new to
      // record — a second audit entry would read as a second order.
      return outcome.order;
    }

    if (outcome.kind === "created") {
      placed = outcome.order;
      break;
    }

    candidate = { ...candidate, orderNumber: await generateOrderNumber(commerce) };
  }

  if (!placed) {
    // Never claim a placement we could not make. The caller reports the order
    // unconfirmed and the customer can retry, which is recoverable; a false
    // success is not.
    throw new Error("Could not allocate a unique order number");
  }

  // Best-effort: refresh each affected product's derived stockStatus (the $inc
  // changed the quantity but not the status field). Not part of the transaction.
  await refreshStockStatuses(input.items.map((i) => i.productSlug));

  await writeAuditLog({
    action: "order.place",
    actorEmail: input.address.email,
    target: { type: "order", id: placed.id },
    metadata: {
      orderNumber: placed.orderNumber,
      total: input.totals.total,
      method: input.paymentMethod,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  // Awaited, but never allowed to fail the placement: the order is already
  // committed and paid for, so throwing here would report a successful order as
  // failed and send the customer into the retry path for something that is
  // already done. A missing confirmation email is an operator problem.
  // An absolute URL, because an email is read outside the app where a relative
  // path goes nowhere. Every variable the template declares is supplied here —
  // an unsupplied one renders as the literal `{{invoice_url}}` in the customer's
  // inbox, which is how this was caught.
  const base = await publicBaseUrl();
  const mail = await sendTemplatedEmail("order_confirmation", placed.address.email, {
    customer_name: placed.address.fullName?.trim() || "there",
    order_number: placed.orderNumber,
    order_total: formatCurrency(placed.totals.total, currency),
    payment_method: placed.paymentMethod === "cod" ? "Cash on delivery" : "Paid online",
    delivery_date: placed.deliverySlot?.date
      ? `${placed.deliverySlot.date}${placed.deliverySlot.timeSlot ? `, ${placed.deliverySlot.timeSlot}` : ""}`
      : new Date(placed.estimatedDelivery).toDateString(),
    invoice_url: base
      ? `${base}${routes.store.orderTrack}?order=${encodeURIComponent(placed.orderNumber)}`
      : "Reply to this email and we will send your invoice.",
  });

  if (!mail.sent) {
    console.error(
      `[orders] Could not email the confirmation for ${placed.orderNumber}: ${mail.error}`
    );
  }

  return placed;
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
