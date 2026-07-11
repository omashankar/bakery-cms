import type { OrderStatus } from "./orders";

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
  pending: "Pending",
  confirmed: "Confirmed",
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
