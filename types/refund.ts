export type RefundStatus = "requested" | "processing" | "completed" | "rejected";

export type RefundReasonCode =
  | "customer_request"
  | "duplicate_order"
  | "quality_issue"
  | "delivery_failed"
  | "payment_error"
  | "order_cancelled"
  | "other";

export interface RefundEvent {
  status: RefundStatus;
  at: string;
  note?: string;
}

/**
 * One refund the payment gateway actually acknowledged.
 *
 * The `id` is the gateway's — `rfnd_…` for Razorpay — and is the only reference
 * that reconciles against anything. The old `REF-<orderNumber>` string this
 * codebase minted for itself matched no record at any gateway or bank.
 *
 * `status` is the gateway's word, not ours. A refund is created `pending` and
 * becomes `processed` only when the money has left; it can still end `failed` at
 * the bank days later. Recording `processed` at creation time is what made the
 * old Refund Centre lie.
 */
export interface GatewayRefund {
  /** The gateway's refund id. */
  id: string;
  /** Major units, as the gateway confirmed it. */
  amount: number;
  status: "pending" | "processed" | "failed";
  createdAt: string;
  /** When the gateway told us it had settled. Absent while `pending`. */
  processedAt?: string;
  /** The gateway's reason, when it ended `failed`. */
  failureReason?: string;
}

export interface RefundRecord {
  /**
   * Bumped on every write. The optimistic-concurrency key.
   *
   * Neither the size of `gatewayRefunds` nor the refunded total works on its
   * own: promoting a refund from `pending` to `processed` changes neither, so a
   * request holding a stale copy would overwrite the gateway's own confirmation
   * — and an offline refund appends nothing to the array, so two concurrent cash
   * refunds would both match a size guard. A counter changes on every write by
   * construction.
   */
  version?: number;
  status: RefundStatus;
  reason: RefundReasonCode;
  reasonDetail?: string;
  /**
   * TOTAL refunded across every attempt — not just the most recent one.
   *
   * Derived from `gatewayRefunds` (excluding failed ones) so a second partial
   * refund adds to the first instead of replacing it. Before this it held only
   * the latest attempt, which meant two ₹200 refunds on a ₹1000 order reported
   * ₹200 refunded and left the order marked fully refunded after the first.
   */
  amount: number;
  /** The gateway refund id for the most recent attempt, or the manual reference for an offline refund. */
  reference?: string;
  notes?: string;
  requestedAt?: string;
  completedAt?: string;
  history: RefundEvent[];
  /** Every gateway refund attempted for this order, oldest first. Empty for an offline refund. */
  gatewayRefunds?: GatewayRefund[];
  /**
   * No gateway was involved — cash returned by hand for a delivered COD order.
   * Recorded so the ledger does not imply a payout that any gateway could confirm.
   */
  offline?: boolean;
  /**
   * Stock has already been put back for this order.
   *
   * Persisted rather than inferred, because with partial refunds the "is it fully
   * refunded now" test can flip back and forth — a refund that fails at the bank
   * reduces the refunded total again — and each flip would put the same cakes
   * back on the shelf a second time.
   */
  stockRestored?: boolean;
  /**
   * The coupon redemption has already been handed back.
   *
   * Separate from `stockRestored` because the two have different conditions —
   * stock does not come back for a delivered order, a coupon always does — and
   * because a gateway refund settles asynchronously, so the moment an order
   * becomes fully refunded can arrive on either the admin's request or the
   * gateway's later webhook. A persisted flag is what makes it once, on
   * whichever path gets there.
   */
  couponReleased?: boolean;
}
