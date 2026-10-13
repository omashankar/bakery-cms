import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { AppError, NotFoundError } from "@/lib/server/http/errors";
import { getRazorpayStatus } from "@/lib/server/payments/razorpay-credentials";
import { getSettings } from "@/features/settings/server/settings.service";
import { sendTemplatedEmail } from "@/features/communications/server/email.service";
import * as productRepo from "@/features/products/server/product.repository";
import { settledRefundAmount } from "@/features/orders/lib/order-overviews";
import {
  CANCELLATION_REASON_LABELS,
  CANCELLATION_RESOLUTION_LABELS,
  CUSTOMER_CANCELLATION_REASONS,
  DEFAULT_CANCELLATION_CLASS,
  evaluateCancellation,
  isCancellationClass,
  isOpenCancellationRequest,
  preparationStage,
  preparationStartedAt,
  resolutionCancelsOrder,
  statusForResolution,
  strictestClass,
  type CancellationClass,
  type CancellationReason,
  type CancellationRequest,
  type CancellationResolution,
} from "@/features/orders/lib/cancellation-policy";
import type { PlacedOrder } from "@/features/orders/lib/orders";
import type { CommerceSettings, GeneralSettings } from "@/types/settings";
import { formatCurrency } from "@/utils/format";

import * as repo from "./order.repository";
import { cancel, declineRefund, refund } from "./order.service";

/**
 * THE CANCELLATION WORKFLOW — a customer (or the shop) asks, the policy says
 * what it expects, and a person in the shop decides.
 *
 * Built on what already exists rather than beside it: the order's own status
 * is the kitchen stage, `cancel()` closes the order and puts the stock back,
 * `refund()` asks Razorpay what is left and pays it out under the refund
 * record's version check, and `declineRefund()` records a refund the shop will
 * not pay. This service adds the request, the judgement and the decision.
 *
 * Every rule that matters is enforced HERE, on the server: ownership, the
 * policy, one request per order, one decision per request, and an amount no
 * larger than what is left to refund.
 */

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

async function commerceSettings(): Promise<{ commerce: CommerceSettings; currency?: string }> {
  const settings = (await getSettings().catch(() => null)) as Record<string, unknown> | null;
  return {
    commerce: ((settings?.commerce ?? {}) as CommerceSettings),
    currency: (settings?.general as GeneralSettings | undefined)?.currency,
  };
}

/**
 * The class this order is judged by: the copy taken at placement, or — for an
 * order placed before copies existed — its products as they are now.
 */
async function policyClassOf(order: PlacedOrder): Promise<CancellationClass> {
  if (order.cancellationPolicy?.policyClass) return order.cancellationPolicy.policyClass;
  const classes = await Promise.all(
    [...new Set(order.items.map((item) => item.productSlug).filter(Boolean))].map(async (slug) => {
      const product = await productRepo.findBySlug(slug).catch(() => null);
      return isCancellationClass(product?.cancellationClass)
        ? product.cancellationClass
        : DEFAULT_CANCELLATION_CLASS;
    }),
  );
  return strictestClass(classes);
}

/** Money the customer has actually handed over and not yet had back. */
function moneyHeld(order: PlacedOrder): number {
  const taken =
    order.paymentStatus === "paid" || (order.paymentMethod === "cod" && order.status === "delivered");
  if (!taken) return 0;
  return Math.max(0, Math.round((order.totals.total - settledRefundAmount(order)) * 100) / 100);
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

async function emailCustomer(
  order: PlacedOrder,
  slug: "cancellation_requested" | "cancellation_decided",
  vars: Record<string, string>,
): Promise<void> {
  const to = order.address?.email?.trim();
  if (!to) return;
  const mail = await sendTemplatedEmail(slug, to, {
    customer_name: order.address.fullName?.trim() || "there",
    order_number: order.orderNumber,
    ...vars,
  }).catch((error: unknown) => ({ sent: false, error }));
  if (!mail.sent) {
    console.error(`[cancellation] Could not email ${slug} for ${order.orderNumber}`, mail.error);
  }
}

/* -------------------------------------------------------------------------- */
/* Asking                                                                     */
/* -------------------------------------------------------------------------- */

export interface CancellationRequestInput {
  reason: CancellationReason;
  detail?: string;
}

async function openRequest(
  order: PlacedOrder,
  input: CancellationRequestInput,
  requestedBy: "customer" | "staff",
  ctx: RequestCtx,
): Promise<PlacedOrder> {
  const stage = preparationStage(order.status);
  const startedAt = preparationStartedAt(order);
  const policyClass = await policyClassOf(order);
  const judgement = evaluateCancellation({ policyClass, stage, startedAt, reason: input.reason });

  if (judgement.eligibility === "not_allowed" || stage === null) {
    throw new AppError(judgement.explanation, 409);
  }

  const now = new Date().toISOString();
  const status = judgement.eligibility === "exception_review" ? "under_review" : "requested";
  const request: CancellationRequest = {
    version: 1,
    status,
    reason: input.reason,
    ...(input.detail?.trim() ? { detail: input.detail.trim().slice(0, 1000) } : {}),
    requestedAt: now,
    requestedBy,
    eligibility: judgement.eligibility,
    policyClass,
    stageAtRequest: stage,
    ...(startedAt ? { preparationStartedAt: startedAt } : {}),
    history: [
      {
        status,
        at: now,
        note: CANCELLATION_REASON_LABELS[input.reason],
        actor: requestedBy === "customer" ? "customer" : ctx.actorEmail,
      },
    ],
  };

  const opened = await repo.openCancellationRequest(order.id, request);
  if (!opened) {
    // Either a request already exists or the order closed in between. Both
    // are "not again", and both get the same answer.
    throw new AppError(
      "A cancellation request is already open for this order, or it can no longer be cancelled.",
      409,
    );
  }

  await audit(ctx, "order.cancellation.request", order.id, {
    reason: input.reason,
    eligibility: judgement.eligibility,
    requestedBy,
  });
  await emailCustomer(opened, "cancellation_requested", {
    cancellation_reason: CANCELLATION_REASON_LABELS[input.reason],
    cancellation_outcome: judgement.explanation,
  });
  return opened;
}

/**
 * The CUSTOMER asks, from My Orders. The order is found by its number and
 * then checked against the SIGNED-IN customer's email — never an email from
 * the request — and a stranger's order answers "not found", the same as a
 * missing one, so a number cannot be used to probe for orders.
 */
export async function requestCancellationAsCustomer(
  orderNumber: string,
  customerEmail: string,
  input: CancellationRequestInput,
  ctx: RequestCtx,
): Promise<PlacedOrder> {
  const { commerce } = await commerceSettings();
  if (commerce.customerCancellationRequests === false) {
    throw new AppError("This shop takes cancellation requests by phone or email. Please contact us.", 403);
  }
  if (!CUSTOMER_CANCELLATION_REASONS.includes(input.reason)) {
    throw new AppError("Please choose a reason from the list.", 400);
  }

  const order = await repo.findByNumber(orderNumber);
  const owner = order?.address?.email?.trim().toLowerCase();
  if (!order || !owner || owner !== customerEmail.trim().toLowerCase()) {
    throw new NotFoundError("Order not found");
  }

  return openRequest(order, input, "customer", ctx);
}

/**
 * The SHOP opens a case itself — the customer phoned, or the shop cannot
 * make the order. Any reason, including "the shop cannot fulfil".
 */
export async function openCancellationAsStaff(
  orderId: string,
  input: CancellationRequestInput,
  ctx: RequestCtx,
): Promise<PlacedOrder> {
  const order = await repo.findById(orderId);
  if (!order) throw new NotFoundError("Order not found");
  return openRequest(order, input, "staff", ctx);
}

/** Every order with a cancellation request, newest first. */
export function listCancellationCases(): Promise<PlacedOrder[]> {
  return repo.listCancellationCases();
}

/* -------------------------------------------------------------------------- */
/* Reviewing                                                                  */
/* -------------------------------------------------------------------------- */

function openRequestOf(order: PlacedOrder | null): CancellationRequest {
  const request = order?.cancellationRequest;
  if (!order || !request) throw new NotFoundError("This order has no cancellation request");
  if (!isOpenCancellationRequest(request.status)) {
    throw new AppError("This cancellation request has already been decided.", 409);
  }
  return request;
}

/** A person has picked the request up: Requested → Under review. */
export async function startCancellationReview(orderId: string, ctx: RequestCtx): Promise<PlacedOrder> {
  const order = await repo.findById(orderId);
  const request = openRequestOf(order);
  if (request.status === "under_review") return order as PlacedOrder;

  const now = new Date().toISOString();
  const updated = await repo.compareAndSetCancellation(orderId, request.version, {
    ...request,
    version: request.version + 1,
    status: "under_review",
    history: [...request.history, { status: "under_review", at: now, actor: ctx.actorEmail }],
  });
  if (!updated) throw new AppError("This request changed while you were looking at it. Reload and try again.", 409);

  await audit(ctx, "order.cancellation.review", orderId);
  return updated;
}

export interface CancellationDecisionInput {
  resolution: CancellationResolution;
  reason: string;
  /** Partial refunds only. */
  refundAmount?: number;
}

export interface CancellationDecisionResult {
  order: PlacedOrder;
  /** Set when the decision stands but the refund could not be started. */
  refundError?: string;
}

/**
 * THE SHOP DECIDES.
 *
 * Everything that could refuse is checked BEFORE anything is written, so a
 * refused decision changes nothing. Then the decision is CLAIMED (version
 * check — a second admin deciding the same request gets a 409), and only then
 * are the order and the money moved, with the tools that already do that
 * safely: `cancel`, `refund`, `declineRefund`.
 *
 * A refund that the gateway will not start does not undo the decision — the
 * shop decided, and the order is cancelled. It is recorded on the request's
 * history, returned to the admin, and left for Issue refund in the Refund
 * Center to retry. The customer is told the refund has not started, not that
 * it has.
 */
export async function decideCancellation(
  orderId: string,
  input: CancellationDecisionInput,
  ctx: RequestCtx,
): Promise<CancellationDecisionResult> {
  const order = await repo.findById(orderId);
  const request = openRequestOf(order);
  const current = order as PlacedOrder;

  const reason = input.reason?.trim();
  if (!reason) throw new AppError("Write down why — it is kept with the decision.", 400);

  const held = moneyHeld(current);
  const delivered = current.status === "delivered";

  if (input.resolution === "partial_refund") {
    const amount = Number(input.refundAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError("Enter the amount to refund.", 400);
    }
    if (held <= 0) throw new AppError("No payment is held on this order, so there is nothing to refund.", 409);
    if (amount > held) {
      throw new AppError(`At most ${formatCurrency(held)} can be refunded on this order.`, 409);
    }
  }
  if (input.resolution === "cancel_no_refund" && delivered) {
    throw new AppError("A delivered order cannot be cancelled. Refund part or all of it, or reject the request.", 409);
  }
  if ((input.resolution === "remake" || input.resolution === "reschedule") && current.status === "cancelled") {
    throw new AppError("This order is already cancelled.", 409);
  }

  const now = new Date().toISOString();
  const status = statusForResolution(input.resolution);
  const refundAmount =
    input.resolution === "partial_refund"
      ? Number(input.refundAmount)
      : input.resolution === "full_refund"
        ? held
        : undefined;

  const decided: CancellationRequest = {
    ...request,
    version: request.version + 1,
    status,
    decision: {
      resolution: input.resolution,
      reason,
      ...(refundAmount !== undefined ? { refundAmount } : {}),
      at: now,
      actorEmail: ctx.actorEmail,
    },
    history: [
      ...request.history,
      {
        status,
        at: now,
        note: `${CANCELLATION_RESOLUTION_LABELS[input.resolution]} — ${reason}`,
        actor: ctx.actorEmail,
      },
    ],
  };

  const claimed = await repo.compareAndSetCancellation(orderId, request.version, decided);
  if (!claimed) {
    throw new AppError("Someone else decided this request just now. Reload to see what they chose.", 409);
  }

  await audit(ctx, "order.cancellation.decide", orderId, {
    resolution: input.resolution,
    refundAmount,
    reason,
  });

  // ---- moving the order and the money ----------------------------------
  let result: PlacedOrder = claimed;
  let refundError: string | undefined;
  const cancelNote = `Cancellation request: ${CANCELLATION_RESOLUTION_LABELS[input.resolution]}`;

  if (resolutionCancelsOrder(input.resolution) && !delivered && current.status !== "cancelled") {
    result = (await cancel(orderId, cancelNote, ctx, { notifyCustomer: false })) ?? result;
  }

  if ((input.resolution === "full_refund" || input.resolution === "partial_refund") && held > 0) {
    try {
      result =
        (await refund(
          orderId,
          {
            reason: "order_cancelled",
            reasonDetail: reason,
            ...(input.resolution === "partial_refund" ? { amount: refundAmount } : {}),
          },
          ctx,
        )) ?? result;
    } catch (error) {
      refundError = error instanceof Error ? error.message : "The refund could not be started.";
      result = (await noteOnRequest(orderId, `Refund not started: ${refundError}`, ctx)) ?? result;
    }
  }

  if (input.resolution === "cancel_no_refund" && result.refundRecord?.status === "requested") {
    result = (await declineRefund(orderId, reason, ctx).catch(() => null)) ?? result;
  }

  // ---- telling the customer what actually happened ----------------------
  const { currency } = await commerceSettings();
  const testMode = (await getRazorpayStatus().catch(() => null))?.testMode === true;
  await emailCustomer(result, "cancellation_decided", {
    cancellation_decision: CANCELLATION_RESOLUTION_LABELS[input.resolution],
    decision_reason: `Reason: ${reason}`,
    refund_note: refundNote(input.resolution, held, refundAmount, refundError, currency, testMode),
  });

  return { order: result, ...(refundError ? { refundError } : {}) };
}

/** Add a line to the request's history without changing its status. */
async function noteOnRequest(orderId: string, note: string, ctx: RequestCtx): Promise<PlacedOrder | null> {
  const order = await repo.findById(orderId);
  const request = order?.cancellationRequest;
  if (!request) return null;
  return repo.compareAndSetCancellation(orderId, request.version, {
    ...request,
    version: request.version + 1,
    history: [...request.history, { status: request.status, at: new Date().toISOString(), note, actor: ctx.actorEmail }],
  });
}

/**
 * The money sentence — only ever what has HAPPENED. A refund started is "on
 * its way once the payment provider confirms", never "refunded"; a test-mode
 * refund says no real money moves.
 */
export function refundNote(
  resolution: CancellationResolution,
  held: number,
  refundAmount: number | undefined,
  refundError: string | undefined,
  currency: string | undefined,
  testMode: boolean,
): string {
  const simulated = testMode
    ? " (Test mode: this refund is simulated — no real money moves.)"
    : "";
  switch (resolution) {
    case "full_refund":
    case "partial_refund":
      if (held <= 0) return "No payment was taken for this order, so there is nothing to refund.";
      if (refundError) {
        return "Your refund could not be started automatically. The shop will complete it and let you know — nothing has been refunded yet.";
      }
      return `We have started a refund of ${formatCurrency(refundAmount ?? held, currency)} to the way you paid. We will email you again once the payment provider confirms it; banks usually take 5–7 working days.${simulated}`;
    case "cancel_no_refund":
      return "Under the cancellation policy you agreed to, this order is cancelled without a refund.";
    case "remake":
      return "Your order stays open — the shop will contact you about remaking it.";
    case "reschedule":
      return "Your order stays open — the shop will contact you about a new date.";
    case "rejected":
      return "Your order stays as it is.";
  }
}
