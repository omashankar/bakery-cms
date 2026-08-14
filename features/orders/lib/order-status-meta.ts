import type { OrderStatus } from "@/features/orders/lib/orders";

export const FULFILLMENT_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
];

export const TERMINAL_STATUSES: OrderStatus[] = ["cancelled", "refunded"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order placed",
  confirmed: "Accepted",
  preparing: "Preparing",
  ready: "Cake ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const ORDER_STATUS_DESCRIPTIONS: Record<OrderStatus, string> = {
  pending: "Awaiting payment or confirmation.",
  confirmed: "We received your order and payment details.",
  preparing: "Our bakers are crafting your order with care.",
  ready: "Your cake is packed and ready for dispatch.",
  out_for_delivery: "Your order is on the way to your address.",
  delivered: "Enjoy your cakes!",
  cancelled: "This order was cancelled.",
  refunded: "A refund has been issued for this order.",
};

export function formatOrderStatus(status: OrderStatus): string {
  return ORDER_STATUS_LABELS[status];
}

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * The fulfilment ladder is `FULFILLMENT_STATUSES` itself — the order it is
 * written in IS the order of the steps.
 *
 * It was a second copy of the same six values. Two lists that must agree and
 * nothing making them: reordering one is a silent behaviour change in the other,
 * which a mutation run demonstrated by editing the copy this rule does not read.
 *
 * An order climbs the ladder and never descends. Skipping a rung is allowed — a
 * shop that never marks "ready" should not have to click through it — but going
 * back is not, because each step has already told the customer something.
 * Moving `out_for_delivery` back to `preparing` and forward again sends the
 * "on its way" email twice.
 */

/**
 * Why a status change is not allowed, or null when it is.
 *
 * There was no rule anywhere on the write path. `updateStatus` only skipped a
 * no-op, and the ONLY place the terminal rule existed was a `disabled` prop on
 * the detail page's dropdown — `isTerminalOrderStatus` had not a single
 * server-side caller. The Orders list gives every row a checkbox including under
 * the Cancelled and Refunded tabs, so select-all → bulk status → Apply wrote a
 * refunded order back to `delivered`: its total re-entered the Revenue card
 * having been paid back, it re-entered the fulfilment queue, and cancelling it a
 * second time restored its stock a second time.
 */
export function orderStatusTransitionError(
  from: OrderStatus,
  to: OrderStatus,
): string | null {
  if (from === to) return null;

  if (isTerminalOrderStatus(from)) {
    return `This order is ${ORDER_STATUS_LABELS[from].toLowerCase()}. Its status cannot be changed.`;
  }

  const fromRung = FULFILLMENT_STATUSES.indexOf(from);
  const toRung = FULFILLMENT_STATUSES.indexOf(to);

  // A status outside the ladder is cancelled or refunded, which have their own
  // endpoints — the validator already refuses them here.
  if (toRung < 0) {
    return "Use the cancel or refund action for that — they move stock and money.";
  }
  if (fromRung < 0) return null;

  if (toRung < fromRung) {
    return `An order cannot go back from ${ORDER_STATUS_LABELS[from].toLowerCase()} to ${ORDER_STATUS_LABELS[to].toLowerCase()}.`;
  }

  return null;
}
