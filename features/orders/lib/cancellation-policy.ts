/**
 * CANCELLATION AND CASH ON DELIVERY — the two product toggles, as pure rules.
 *
 * The shop asked for it simple: per product, "Order cancel" on or off, and
 * "Cash on Delivery" on or off. Nothing more.
 *
 *   Order cancel ON  — the customer may cancel from My Orders until the shop
 *                      starts preparing the order.
 *   Order cancel OFF — no cancel button for that order at all.
 *
 * An order with several products is judged by its strictest line: one
 * product that cannot be cancelled makes the whole order uncancellable (an
 * order is cancelled whole).
 *
 * A customer with a problem (wrong or damaged order) still contacts the shop;
 * the shop can always cancel and refund from the admin.
 *
 * Pure and import-free on purpose: the storefront shows the rule with these
 * and the server enforces it with the same functions, so the two cannot
 * disagree.
 */

/* -------------------------------------------------------------------------- */
/* The "Order cancel" toggle                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Stored per product. "standard" is what a product never toggled carries, and
 * reads as ON; "made_to_order" is ON; "non_cancellable" is OFF.
 */
export type CancellationClass = "standard" | "made_to_order" | "non_cancellable";

export const CANCELLATION_CLASSES: readonly CancellationClass[] = [
  "standard",
  "made_to_order",
  "non_cancellable",
];

export const DEFAULT_CANCELLATION_CLASS: CancellationClass = "standard";

/** One line, for the product page and checkout. */
export const CANCELLATION_CLASS_CUSTOMER_TEXT: Record<CancellationClass, string> = {
  standard: "Can be cancelled until we start preparing it.",
  made_to_order: "Can be cancelled until we start preparing it.",
  non_cancellable: "Cannot be cancelled once ordered.",
};

/** The same rule in two or three words, for the icon row on the product page. */
export const CANCELLATION_CLASS_SHORT_TEXT: Record<CancellationClass, string> = {
  standard: "Cancel before preparing",
  made_to_order: "Cancel before preparing",
  non_cancellable: "No cancellation",
};

export function isCancellableClass(cls: CancellationClass | undefined): boolean {
  return (cls ?? DEFAULT_CANCELLATION_CLASS) !== "non_cancellable";
}

export function classForCancellableTick(cancellable: boolean): CancellationClass {
  return cancellable ? "made_to_order" : "non_cancellable";
}

export function isCancellationClass(value: unknown): value is CancellationClass {
  return typeof value === "string" && (CANCELLATION_CLASSES as readonly string[]).includes(value);
}

/** The class an order is judged by: OFF if any line is off. */
export function strictestClass(classes: readonly (CancellationClass | undefined)[]): CancellationClass {
  if (classes.some((cls) => cls === "non_cancellable")) return "non_cancellable";
  if (classes.some((cls) => cls === "made_to_order")) return "made_to_order";
  return DEFAULT_CANCELLATION_CLASS;
}

/* -------------------------------------------------------------------------- */
/* Preparation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Where the order is in the kitchen, read off the status staff already set:
 *
 *   pending / confirmed  → not_started
 *   preparing            → in_progress
 *   ready                → ready
 *   out_for_delivery     → dispatched
 *   delivered            → delivered
 *
 * `null` for an order that is closed (cancelled or refunded).
 */
export type PreparationStage = "not_started" | "in_progress" | "ready" | "dispatched" | "delivered";

export const PREPARATION_STAGE_LABELS: Record<PreparationStage, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  ready: "Ready",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

export function preparationStage(status: string): PreparationStage | null {
  switch (status) {
    case "pending":
    case "confirmed":
      return "not_started";
    case "preparing":
      return "in_progress";
    case "ready":
      return "ready";
    case "out_for_delivery":
      return "dispatched";
    case "delivered":
      return "delivered";
    default:
      return null;
  }
}

const STARTED_STATUSES = new Set(["preparing", "ready", "out_for_delivery", "delivered"]);

/**
 * When preparation ACTUALLY started: the stored stamp, or the first time
 * staff moved the order into a kitchen step. Never the placing or the paying
 * of the order — an order nobody has touched has not started.
 */
export function preparationStartedAt(order: {
  preparationStartedAt?: string;
  statusHistory?: readonly { status: string; at: string }[];
}): string | undefined {
  if (order.preparationStartedAt) return order.preparationStartedAt;
  return order.statusHistory?.find((event) => STARTED_STATUSES.has(event.status))?.at;
}

/* -------------------------------------------------------------------------- */
/* May the customer cancel?                                                   */
/* -------------------------------------------------------------------------- */

export interface CustomerCancellation {
  allowed: boolean;
  /** Why not, in the customer's words — or what cancelling will do. */
  message: string;
}

/**
 * The whole rule: the order's products allow it, and the shop has not started
 * preparing it.
 */
export function customerCancellation(order: {
  status: string;
  policyClass: CancellationClass;
  preparationStartedAt?: string;
  statusHistory?: readonly { status: string; at: string }[];
}): CustomerCancellation {
  const stage = preparationStage(order.status);
  if (stage === null) return { allowed: false, message: "This order is already closed." };
  if (order.policyClass === "non_cancellable") {
    return { allowed: false, message: "This order cannot be cancelled. Please contact the shop if something is wrong." };
  }
  if (stage !== "not_started" || preparationStartedAt(order)) {
    return {
      allowed: false,
      message: "The shop has started preparing this order, so it can no longer be cancelled. Please contact the shop.",
    };
  }
  return {
    allowed: true,
    message: "Your order will be cancelled. Anything you paid online is refunded to the way you paid.",
  };
}

/* -------------------------------------------------------------------------- */
/* The refund's state                                                         */
/* -------------------------------------------------------------------------- */

export type RefundState = "not_applicable" | "pending" | "processing" | "processed" | "failed";

export const REFUND_STATE_LABELS: Record<RefundState, string> = {
  not_applicable: "Not applicable",
  pending: "Pending",
  processing: "Processing",
  processed: "Processed",
  failed: "Failed",
};

/**
 * Read from the refund record the gateway writes to — so "Processed" means the
 * gateway said so, never that an email went out.
 */
export function refundState(order: {
  refundRecord?: {
    status: string;
    gatewayRefunds?: readonly { status: string }[];
    offline?: boolean;
  };
}): RefundState {
  const record = order.refundRecord;
  if (!record) return "not_applicable";
  if (record.status === "completed") return "processed";
  const gateway = record.gatewayRefunds ?? [];
  if (gateway.some((refund) => refund.status === "pending")) return "processing";
  // Checked BEFORE "rejected": a refund the bank bounced leaves the record
  // reading `rejected` too, and that one is a failure the shop must retry —
  // not a request it declined.
  if (gateway.length > 0 && gateway.every((refund) => refund.status === "failed")) return "failed";
  if (record.status === "rejected") return "not_applicable";
  if (record.status === "processing") return "processing";
  return "pending";
}

/* -------------------------------------------------------------------------- */
/* What an order stores                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The rule as it stood when the order was placed — a COPY, not a pointer. A
 * product toggled off next month does not change orders already placed.
 */
export interface OrderCancellationPolicy {
  version: string;
  /** The shop's policy wording, as shown at checkout. */
  text: string;
  /** The class the order is judged by (the strictest line). */
  policyClass: CancellationClass;
  itemClasses: { productSlug: string; policyClass: CancellationClass }[];
  /** When the customer ticked the checkout agreement. Absent if they did not. */
  acceptedAt?: string;
}

/** A fingerprint of a policy: the wording plus every line's class. */
export function policyVersion(text: string, itemClasses: readonly { productSlug: string; policyClass: string }[]): string {
  const source = `${text}\n${[...itemClasses]
    .map((item) => `${item.productSlug}=${item.policyClass}`)
    .sort()
    .join(",")}`;
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) >>> 0;
  }
  return `p${hash.toString(36)}`;
}

/* -------------------------------------------------------------------------- */
/* Cash on delivery                                                           */
/* -------------------------------------------------------------------------- */

/**
 * The shop's own toggle, on unless switched off. One product that takes no
 * cash makes the whole order pay online.
 */
export function productAllowsCod(product: { codAllowed?: boolean }): boolean {
  return product.codAllowed !== false;
}
