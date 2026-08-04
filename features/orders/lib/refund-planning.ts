import type { GatewayRefund, RefundRecord, RefundStatus } from "@/types/refund";

/**
 * What a refund request should actually do — decided before any money moves.
 *
 * Pure, so the rules can be tested without a gateway or a database. The old
 * `refund()` had no rules at all: it clamped the amount to the order total,
 * wrote "completed", and returned. It never asked whether anything had been
 * collected in the first place, so a COD order that was never delivered and an
 * online order whose payment failed could both be "refunded" — the shop's books
 * then showed money going out that had never come in.
 */

export type RefundPlan =
  /** Ask the gateway to move `amount` back. */
  | { kind: "gateway"; amount: number }
  /** Cash returned by hand. No gateway can confirm this, and the record says so. */
  | { kind: "offline"; amount: number }
  /** Nothing left to refund. Not an error — the caller returns the order unchanged. */
  | { kind: "noop"; reason: string }
  /** Must not happen. `retryable` separates "ask again later" from "never". */
  | { kind: "refuse"; reason: string; retryable: boolean };

/** Rupee comparisons need a tolerance; floats do not land on exact totals. */
const EPSILON = 0.005;

/**
 * How much has really been refunded so far.
 *
 * Sums the gateway refunds that have not failed, because that is the money that
 * has left (or is on its way out). A `failed` refund moved nothing and must not
 * reduce what is still refundable, or a bank rejection would quietly eat the
 * customer's remaining claim.
 *
 * Falls back to the stored total for records written before gateway refunds
 * existed, and for offline ones where there is no gateway list to sum.
 */
export function totalRefunded(record?: RefundRecord | null): number {
  if (!record) return 0;

  const gatewayRefunds = record.gatewayRefunds;
  if (Array.isArray(gatewayRefunds) && gatewayRefunds.length > 0) {
    return gatewayRefunds
      .filter((refund) => refund.status !== "failed")
      .reduce((sum, refund) => sum + (Number(refund.amount) || 0), 0);
  }

  // Cash handed back by hand. No gateway list exists for it and none ever will,
  // so the stored figure IS the money that moved.
  if (record.offline) return Number(record.amount) || 0;

  // No gateway refunds and not offline: this record is a CLAIM, not a payout.
  //
  // Two kinds reach here and neither moved a rupee. Records written by the old
  // code carry `status: "completed"` and a `REF-…` reference invented locally —
  // the whole premise of this change is that none of those refunded anything.
  // And `requestRefund` writes one at the FULL order total with no payment check
  // at all. Returning `record.amount` for either made the money look already
  // returned, so `planRefund` saw nothing left, answered `noop`, and the
  // endpoint reported "Order refunded" — a legitimate payout became impossible,
  // with a success toast on top. Merely REQUESTING a refund was enough to make
  // the refund unperformable.
  return 0;
}

export interface RefundContext {
  paymentMethod: string;
  /** The order's own lifecycle status — a COD order only holds cash once delivered. */
  status: string;
  orderTotal: number;
  paymentReference?: string;
  refundRecord?: RefundRecord | null;
  /**
   * What the GATEWAY says can still be refunded, in major units.
   * `null` means we could not ask it — never treat that as zero.
   * Ignored for COD.
   */
  gatewayRefundable: number | null;
  /** Amount the admin asked for. Absent means "the rest of it". */
  requestedAmount?: number;
}

export function planRefund(context: RefundContext): RefundPlan {
  const { orderTotal } = context;
  const already = totalRefunded(context.refundRecord);
  const remainingOnOrder = orderTotal - already;

  if (remainingOnOrder <= EPSILON) {
    return { kind: "noop", reason: "This order has already been fully refunded." };
  }

  const requested = Number(context.requestedAmount);
  const wanted = Number.isFinite(requested) && requested > 0 ? requested : remainingOnOrder;

  if (context.paymentMethod === "cod") {
    // Cash only exists once it has been handed over. Refunding a COD order that
    // never reached the customer invents an outgoing payment to match an
    // incoming one that never happened.
    if (context.status !== "delivered") {
      return {
        kind: "refuse",
        reason: "This cash-on-delivery order was never collected, so there is nothing to refund.",
        retryable: false,
      };
    }
    return { kind: "offline", amount: round2(Math.min(wanted, remainingOnOrder)) };
  }

  if (!context.paymentReference?.trim()) {
    return {
      kind: "refuse",
      reason: "This order has no payment reference, so no payment can be traced to refund.",
      retryable: false,
    };
  }

  // `null` is "we could not ask", which is an operator problem and worth
  // retrying. Treating it as zero would refuse a legitimate refund; treating it
  // as unlimited would fire a refund we have no idea is valid.
  if (context.gatewayRefundable === null) {
    return {
      kind: "refuse",
      reason: "The payment gateway could not be reached, so the refund was not attempted.",
      retryable: true,
    };
  }

  if (context.gatewayRefundable <= EPSILON) {
    return {
      kind: "refuse",
      reason:
        "The gateway reports nothing left to refund on this payment — it was never captured, or it has already been refunded.",
      retryable: false,
    };
  }

  // The gateway's ceiling wins over ours. Our stored total can be wrong (orders
  // written before payment verification existed carry whatever the browser sent);
  // the gateway's figure is what was really collected — and `gatewayRefundable`
  // is already net of everything Razorpay has really refunded, so a record that
  // merely claims a refund cannot inflate it and cannot block a real one.
  const amount = round2(Math.min(wanted, remainingOnOrder, context.gatewayRefundable));
  if (amount <= EPSILON) {
    return { kind: "noop", reason: "Nothing left to refund on this payment." };
  }
  return { kind: "gateway", amount };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * The record's overall status, derived from the gateway refunds under it.
 *
 * `completed` requires the gateway to have said `processed` — that is the whole
 * point of the change. A refund sitting at `pending` has been accepted but not
 * paid out, and can still fail at the bank; calling that "completed" is what the
 * Refund Centre used to do at the moment the button was clicked.
 */
export function deriveRefundStatus(
  gatewayRefunds: GatewayRefund[],
  offline: boolean,
): RefundStatus {
  if (offline) return "completed";
  if (gatewayRefunds.length === 0) return "requested";

  const live = gatewayRefunds.filter((refund) => refund.status !== "failed");
  if (live.length === 0) return "rejected";
  return live.every((refund) => refund.status === "processed") ? "completed" : "processing";
}

/** Whether the whole order value has been refunded, within rupee tolerance. */
export function isFullyRefunded(orderTotal: number, refunded: number): boolean {
  return orderTotal - refunded <= EPSILON;
}
