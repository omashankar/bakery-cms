/**
 * CANCELLATION POLICY — the rules, as pure functions.
 *
 * A shop that sells more than cakes cannot have one rule. A candle in a box
 * can be cancelled until it leaves; a cake is baked to one customer's order and
 * cannot be sold to anyone else once it is in the oven; a cake with a printed
 * photo of somebody's grandmother cannot be sold to anyone, ever. So every
 * product carries a CLASS, and an order is judged by the strictest class in it
 * (an order is cancelled whole — one line of a mixed cart cannot be).
 *
 * WHAT THESE RULES DO NOT DO is say no to a customer with a genuine problem. A
 * wrong cake, a damaged one, a delivery that never came, a payment that went
 * wrong — those are EXCEPTIONS, at any stage and for any class, and they go to
 * a person in the shop to decide. A no-refund rule for changing your mind is
 * the shop's to set; it cannot be used to refuse a refund the shop owes
 * because of its own mistake, and nothing here tries to.
 *
 * And they decide nothing about money. `evaluateCancellation` says what the
 * policy EXPECTS; the shop's decision (and, for a refund, the gateway's
 * confirmation) is what happens.
 *
 * Pure and import-free on purpose: the storefront explains the policy with
 * these and the server enforces it with the same functions, so the two cannot
 * disagree.
 */

/* -------------------------------------------------------------------------- */
/* Classes                                                                    */
/* -------------------------------------------------------------------------- */

export type CancellationClass = "standard" | "made_to_order" | "non_cancellable";

export const CANCELLATION_CLASSES: readonly CancellationClass[] = [
  "standard",
  "made_to_order",
  "non_cancellable",
];

/** A product with no class set is an ordinary, ready-made item. */
export const DEFAULT_CANCELLATION_CLASS: CancellationClass = "standard";

export const CANCELLATION_CLASS_LABELS: Record<CancellationClass, string> = {
  standard: "Standard — cancel any time before dispatch",
  made_to_order: "Made to order — cancel only before preparation starts",
  non_cancellable: "Personalised — cannot be cancelled once ordered",
};

/** One line, for the product page and checkout. */
export const CANCELLATION_CLASS_CUSTOMER_TEXT: Record<CancellationClass, string> = {
  standard: "Can be cancelled for a full refund until it is dispatched.",
  made_to_order:
    "Made to order: can be cancelled for a full refund until we start preparing it. After that, a change of mind is not refundable.",
  non_cancellable:
    "Personalised for you: cannot be cancelled for a change of mind once ordered.",
};

const STRICTNESS: Record<CancellationClass, number> = {
  standard: 0,
  made_to_order: 1,
  non_cancellable: 2,
};

export function isCancellationClass(value: unknown): value is CancellationClass {
  return typeof value === "string" && (CANCELLATION_CLASSES as readonly string[]).includes(value);
}

/** The class an order is judged by: the strictest of its lines. */
export function strictestClass(classes: readonly (CancellationClass | undefined)[]): CancellationClass {
  let strictest: CancellationClass = DEFAULT_CANCELLATION_CLASS;
  for (const cls of classes) {
    if (cls && STRICTNESS[cls] > STRICTNESS[strictest]) strictest = cls;
  }
  return strictest;
}

/* -------------------------------------------------------------------------- */
/* Reasons                                                                    */
/* -------------------------------------------------------------------------- */

/** A change of plan on the customer's side. Judged by the policy. */
export const ORDINARY_REASONS = [
  "changed_mind",
  "ordered_by_mistake",
  "date_no_longer_suits",
  "other",
] as const;

/**
 * Something went wrong that may be the shop's doing, or that the law protects.
 * NEVER refused by the policy: always reviewed by a person.
 */
export const EXCEPTION_REASONS = [
  "wrong_item",
  "damaged_or_defective",
  "not_delivered_or_late",
  "payment_problem",
  // Staff-only: the shop itself cannot make or deliver the order.
  "shop_cannot_fulfil",
] as const;

export type OrdinaryReason = (typeof ORDINARY_REASONS)[number];
export type ExceptionReason = (typeof EXCEPTION_REASONS)[number];
export type CancellationReason = OrdinaryReason | ExceptionReason;

export const CANCELLATION_REASONS: readonly CancellationReason[] = [
  ...ORDINARY_REASONS,
  ...EXCEPTION_REASONS,
];

/** What a customer may choose. `shop_cannot_fulfil` is the shop's to record. */
export const CUSTOMER_CANCELLATION_REASONS: readonly CancellationReason[] = CANCELLATION_REASONS.filter(
  (reason) => reason !== "shop_cannot_fulfil",
);

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  changed_mind: "I changed my mind",
  ordered_by_mistake: "I ordered by mistake",
  date_no_longer_suits: "The delivery date no longer suits me",
  other: "Another reason",
  wrong_item: "Wrong item, name, photo or design",
  damaged_or_defective: "It arrived damaged or not right",
  not_delivered_or_late: "It was not delivered, or came very late",
  payment_problem: "A problem with my payment",
  shop_cannot_fulfil: "The shop cannot fulfil the order",
};

export function isCancellationReason(value: unknown): value is CancellationReason {
  return typeof value === "string" && (CANCELLATION_REASONS as readonly string[]).includes(value);
}

export function isExceptionReason(reason: CancellationReason): reason is ExceptionReason {
  return (EXCEPTION_REASONS as readonly string[]).includes(reason);
}

/* -------------------------------------------------------------------------- */
/* Preparation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Where the order is in the kitchen, in the policy's words. Read off the
 * order's own status — the fulfilment steps the staff already set — rather
 * than a second status kept beside it:
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
/* The judgement                                                              */
/* -------------------------------------------------------------------------- */

/**
 *   eligible          — the policy allows it, with a full refund of what was paid;
 *   non_refundable    — the policy allows asking, but expects no refund
 *                       (made to order and already started, or personalised);
 *   exception_review  — a problem that may be the shop's: a person decides;
 *   not_allowed       — nothing to cancel any more (closed, or a change of
 *                       mind after it has left the shop).
 *
 * The shop has the last word on every one of these except `not_allowed`.
 */
export type CancellationEligibility =
  | "eligible"
  | "non_refundable"
  | "exception_review"
  | "not_allowed";

export interface CancellationJudgement {
  eligibility: CancellationEligibility;
  /** For the customer, before they send the request. */
  explanation: string;
}

export function evaluateCancellation(input: {
  policyClass: CancellationClass;
  stage: PreparationStage | null;
  startedAt?: string;
  reason: CancellationReason;
}): CancellationJudgement {
  const { policyClass, stage, startedAt, reason } = input;

  if (stage === null) {
    return { eligibility: "not_allowed", explanation: "This order is already closed." };
  }

  if (isExceptionReason(reason)) {
    return {
      eligibility: "exception_review",
      explanation:
        "We will look into this with you. The shop will review what happened and tell you the outcome — a refund, a remake or another fix.",
    };
  }

  if (stage === "dispatched" || stage === "delivered") {
    return {
      eligibility: "not_allowed",
      explanation:
        "This order has already left the shop, so it can no longer be cancelled for a change of plan. If something is wrong with it, choose the reason that describes the problem.",
    };
  }

  if (policyClass === "non_cancellable") {
    return {
      eligibility: "non_refundable",
      explanation:
        "This order is personalised for you, so a change of mind is not refundable. You can still send the request and the shop will reply.",
    };
  }

  if (policyClass === "made_to_order" && (stage !== "not_started" || startedAt)) {
    return {
      eligibility: "non_refundable",
      explanation:
        "We have already started preparing this order, so a change of mind is not refundable under the policy you accepted. You can still send the request and the shop will reply.",
    };
  }

  return {
    eligibility: "eligible",
    explanation:
      "This order can be cancelled. Once the shop confirms, anything you paid online is refunded in full to the way you paid.",
  };
}

/* -------------------------------------------------------------------------- */
/* Request and refund states                                                  */
/* -------------------------------------------------------------------------- */

export type CancellationRequestStatus = "requested" | "under_review" | "approved" | "rejected";

export const CANCELLATION_REQUEST_STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  requested: "Requested",
  under_review: "Under review",
  approved: "Approved",
  rejected: "Rejected",
};

/** A request the shop has not answered yet. */
export function isOpenCancellationRequest(status: CancellationRequestStatus | undefined): boolean {
  return status === "requested" || status === "under_review";
}

/**
 * What the shop decided.
 *
 *   full_refund / partial_refund — cancel the order and refund that much;
 *   cancel_no_refund             — cancel the order and keep the payment
 *                                  (the policy case: already baked);
 *   remake / reschedule          — keep the order and fix it;
 *   rejected                     — keep the order as it is.
 */
export type CancellationResolution =
  | "full_refund"
  | "partial_refund"
  | "cancel_no_refund"
  | "remake"
  | "reschedule"
  | "rejected";

export const CANCELLATION_RESOLUTIONS: readonly CancellationResolution[] = [
  "full_refund",
  "partial_refund",
  "cancel_no_refund",
  "remake",
  "reschedule",
  "rejected",
];

export const CANCELLATION_RESOLUTION_LABELS: Record<CancellationResolution, string> = {
  full_refund: "Cancel and refund in full",
  partial_refund: "Cancel and refund part",
  cancel_no_refund: "Cancel without a refund",
  remake: "Remake / replace",
  reschedule: "Reschedule",
  rejected: "Reject the request",
};

/** Resolutions that close the order. The others keep it going. */
export function resolutionCancelsOrder(resolution: CancellationResolution): boolean {
  return resolution === "full_refund" || resolution === "partial_refund" || resolution === "cancel_no_refund";
}

/** The request's own status once decided: a fix is an approval of the request. */
export function statusForResolution(resolution: CancellationResolution): CancellationRequestStatus {
  return resolution === "rejected" ? "rejected" : "approved";
}

export type RefundState = "not_applicable" | "pending" | "processing" | "processed" | "failed";

export const REFUND_STATE_LABELS: Record<RefundState, string> = {
  not_applicable: "Not applicable",
  pending: "Pending",
  processing: "Processing",
  processed: "Processed",
  failed: "Failed",
};

/**
 * The refund's state, kept SEPARATE from the cancellation's and read from the
 * refund record the gateway writes to — so "Processed" means the gateway said
 * so, never that an email went out.
 */
export function refundState(order: {
  refundRecord?: {
    status: string;
    gatewayRefunds?: readonly { status: string }[];
    offline?: boolean;
  };
}): RefundState {
  const record = order.refundRecord;
  if (!record || record.status === "rejected") return "not_applicable";
  if (record.status === "completed") return "processed";
  const gateway = record.gatewayRefunds ?? [];
  if (gateway.some((refund) => refund.status === "pending")) return "processing";
  if (gateway.length > 0 && gateway.every((refund) => refund.status === "failed")) return "failed";
  if (record.status === "processing") return "processing";
  return "pending";
}

/* -------------------------------------------------------------------------- */
/* What an order stores                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The policy as it stood when the order was placed — a COPY, not a pointer.
 * A shop that tightens its policy next month does not tighten it for orders
 * customers already agreed to under the old one.
 */
export interface OrderCancellationPolicy {
  /** Changes whenever the wording or any line's class changes. */
  version: string;
  /** The shop's policy wording, as shown at checkout. */
  text: string;
  /** The class the order is judged by (the strictest line). */
  policyClass: CancellationClass;
  itemClasses: { productSlug: string; policyClass: CancellationClass }[];
  /** When the customer ticked the checkout agreement. Absent if they did not. */
  acceptedAt?: string;
}

export interface CancellationRequestEvent {
  status: CancellationRequestStatus;
  at: string;
  note?: string;
  /** "customer", or the staff member's email. */
  actor?: string;
}

export interface CancellationDecision {
  resolution: CancellationResolution;
  reason: string;
  /** For a refund resolution: the amount the shop chose to refund. */
  refundAmount?: number;
  at: string;
  actorEmail?: string;
}

export interface CancellationRequest {
  /** Bumped on every write — the optimistic-concurrency key. */
  version: number;
  status: CancellationRequestStatus;
  reason: CancellationReason;
  detail?: string;
  requestedAt: string;
  requestedBy: "customer" | "staff";
  /** What the policy said when the request was made. */
  eligibility: CancellationEligibility;
  policyClass: CancellationClass;
  stageAtRequest: PreparationStage;
  preparationStartedAt?: string;
  decision?: CancellationDecision;
  history: CancellationRequestEvent[];
}

/**
 * A stable fingerprint of a policy: the wording plus every line's class. Not
 * cryptographic — it only has to change when the policy does.
 */
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
