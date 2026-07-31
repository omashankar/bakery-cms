import Razorpay from "razorpay";

import { getRazorpayCredentials } from "@/lib/server/payments/razorpay-credentials";

/**
 * Moving money back to the customer.
 *
 * Until now nothing in this codebase did. `refund()` wrote `status: "completed"`
 * into Mongo, flipped the order to `refunded`, minted its own `REF-…` reference
 * and returned — the customer's money never left the shop's Razorpay account.
 * The admin saw a completed refund, the Refund Centre showed a completed refund,
 * and the ledger agreed with both. That is worse than a missing feature: the
 * system reported a payout that had not happened, and there was nothing in the
 * data to distinguish it from one that had.
 *
 * Two properties this module exists to guarantee:
 *
 *  - A refund is only ever recorded against a real gateway refund id. No id, no
 *    record. `REF-<orderNumber>` reconciled against nothing.
 *  - `processed` is Razorpay's word, not ours. A created refund starts `pending`
 *    and can still fail at the bank, so "completed" is something we learn later
 *    (from `refund.processed`), never something we assume at creation.
 */

export interface RefundOutcome {
  /** The gateway accepted the refund. NOT that the money has landed — see `status`. */
  ok: boolean;
  refundId: string | null;
  /** Razorpay's own state. `pending` means in flight; only `processed` means paid out. */
  status: "pending" | "processed" | "failed" | null;
  /** What the gateway says it is refunding, in major units. */
  amount: number | null;
  /**
   * The gateway could not be asked at all — unconfigured, unreachable, timed out.
   * The refund may or may not exist; an operator has to look. Never treat as a
   * refusal, and never retry blindly.
   */
  unavailable?: string;
  /**
   * The gateway understood and REFUSED (over-refund, payment not captured, already
   * fully refunded). The refund definitively did not happen.
   */
  refused?: string;
}

/** What Razorpay currently believes about a payment, for refund decisions. */
export interface RefundableState {
  /** Money actually collected, major units. */
  captured: number | null;
  /** Already refunded, major units. */
  refunded: number;
  /** captured - refunded, floored at 0. Null when we could not ask. */
  refundable: number | null;
  unavailable?: string;
}

async function client(): Promise<Razorpay | null> {
  const credentials = await getRazorpayCredentials();
  if (!credentials) return null;
  return new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });
}

/** Paise are the gateway's unit. Rounding here rather than at each call site so a
 *  float like 149.99999999 cannot become 14998. */
function toPaise(amount: number): number {
  return Math.round(amount * 100);
}

function toMajor(paise: unknown): number | null {
  const value = typeof paise === "number" ? paise : Number(paise);
  return Number.isFinite(value) ? value / 100 : null;
}

/**
 * How much of this payment can still be refunded, according to the gateway.
 *
 * Asked before every refund so the decision is made against Razorpay's record
 * rather than ours. That matters for orders written before payment verification
 * existed: their stored `paymentStatus: "paid"` may be a client-supplied
 * forgery, and this is what catches it — a payment that was never captured
 * reports nothing refundable.
 */
export async function getRefundableAmount(paymentId: string): Promise<RefundableState> {
  const reference = paymentId.trim();
  if (!reference) {
    return { captured: null, refunded: 0, refundable: null, unavailable: "No payment reference" };
  }

  const razorpay = await client();
  if (!razorpay) {
    return {
      captured: null,
      refunded: 0,
      refundable: null,
      unavailable: "Razorpay credentials are not configured",
    };
  }

  try {
    const payment = await razorpay.payments.fetch(reference);

    // Only a captured payment holds money. `authorized` is a hold that can still
    // expire on its own, and refunding one is not a thing Razorpay allows.
    if (payment?.status !== "captured") {
      return {
        captured: 0,
        refunded: 0,
        refundable: 0,
        unavailable: `Payment is ${String(payment?.status ?? "unknown")}, not captured`,
      };
    }

    const captured = toMajor(payment.amount);
    const refunded = toMajor(payment.amount_refunded ?? 0) ?? 0;
    return {
      captured,
      refunded,
      refundable: captured === null ? null : Math.max(0, captured - refunded),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay lookup failed";
    return { captured: null, refunded: 0, refundable: null, unavailable: message };
  }
}

/**
 * Ask Razorpay to refund part or all of a captured payment.
 *
 * `speed: "normal"` on purpose: `optimum` costs more and can silently fall back
 * anyway, and neither changes whether the refund succeeds — only how fast. The
 * caller is told `pending`, which is the truth for both.
 */
export async function createRazorpayRefund(args: {
  paymentId: string;
  /** Major units. */
  amount: number;
  /** Our own id for this refund, sent so the two ledgers can be lined up later. */
  receipt: string;
  orderNumber: string;
  reason: string;
}): Promise<RefundOutcome> {
  const paymentId = args.paymentId.trim();
  const paise = toPaise(args.amount);

  if (!paymentId) return { ok: false, refundId: null, status: null, amount: null, refused: "No payment reference" };
  if (!Number.isFinite(paise) || paise <= 0) {
    return { ok: false, refundId: null, status: null, amount: null, refused: "Refund amount must be positive" };
  }

  const razorpay = await client();
  if (!razorpay) {
    return {
      ok: false,
      refundId: null,
      status: null,
      amount: null,
      unavailable: "Razorpay credentials are not configured",
    };
  }

  try {
    const refund = await razorpay.payments.refund(paymentId, {
      amount: paise,
      speed: "normal",
      receipt: args.receipt,
      notes: { order: args.orderNumber, reason: args.reason },
    });

    return {
      ok: true,
      refundId: typeof refund?.id === "string" ? refund.id : null,
      status: (refund?.status as RefundOutcome["status"]) ?? "pending",
      amount: toMajor(refund?.amount),
    };
  } catch (error) {
    // Razorpay's errors carry an HTTP status. 4xx is a refusal we can act on and
    // report; anything else (network, 5xx, timeout) leaves the refund's existence
    // genuinely unknown, and saying "refused" there would be a guess that could
    // strand a real payout. So the two are kept apart and the caller treats them
    // differently.
    const status = (error as { statusCode?: number })?.statusCode;
    const described =
      (error as { error?: { description?: string } })?.error?.description ??
      (error instanceof Error ? error.message : "Razorpay refund failed");

    if (typeof status === "number" && status >= 400 && status < 500) {
      return { ok: false, refundId: null, status: null, amount: null, refused: described };
    }
    return { ok: false, refundId: null, status: null, amount: null, unavailable: described };
  }
}

/** Re-read one refund, for reconciling a record we left `processing`. */
export async function fetchRazorpayRefund(
  refundId: string,
): Promise<{ status: RefundOutcome["status"]; amount: number | null; unavailable?: string }> {
  const razorpay = await client();
  if (!razorpay) return { status: null, amount: null, unavailable: "Razorpay credentials are not configured" };

  try {
    const refund = await razorpay.refunds.fetch(refundId.trim());
    return {
      status: (refund?.status as RefundOutcome["status"]) ?? null,
      amount: toMajor(refund?.amount),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Razorpay refund lookup failed";
    return { status: null, amount: null, unavailable: message };
  }
}
