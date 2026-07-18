import type { OrderStatus, PlacedOrder } from "@/features/orders/lib/orders";
import {
  FULFILLMENT_STATUSES,
  isTerminalOrderStatus,
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_STATUS_LABELS,
} from "@/features/orders/lib/order-status-meta";

export interface OrderTimelineStep {
  status: OrderStatus;
  label: string;
  description: string;
  at?: string;
  completed: boolean;
  current: boolean;
}

export function getOrderTimeline(order: PlacedOrder): OrderTimelineStep[] {
  if (order.status === "delivered") {
    const lastIndex = FULFILLMENT_STATUSES.length - 1;
    return FULFILLMENT_STATUSES.map((status, index) => {
      const event = order.statusHistory.find((item) => item.status === status);
      return {
        status,
        label: ORDER_STATUS_LABELS[status],
        description: ORDER_STATUS_DESCRIPTIONS[status],
        at: event?.at ?? (index === lastIndex ? order.estimatedDelivery : undefined),
        completed: true,
        current: index === lastIndex,
      };
    });
  }

  if (isTerminalOrderStatus(order.status)) {
    const event = order.statusHistory.find((item) => item.status === order.status);
    return [
      {
        status: order.status,
        label: ORDER_STATUS_LABELS[order.status],
        description: ORDER_STATUS_DESCRIPTIONS[order.status],
        at: event?.at,
        completed: true,
        current: true,
      },
    ];
  }

  const currentIndex = FULFILLMENT_STATUSES.indexOf(order.status);

  return FULFILLMENT_STATUSES.map((status, index) => {
    const event = order.statusHistory.find((item) => item.status === status);
    const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;

    return {
      status,
      label: ORDER_STATUS_LABELS[status],
      description: ORDER_STATUS_DESCRIPTIONS[status],
      at: event?.at,
      completed: index <= effectiveIndex,
      current: index === effectiveIndex,
    };
  });
}

export function getActiveFulfillmentStatuses(): OrderStatus[] {
  return FULFILLMENT_STATUSES.filter((status) => !isTerminalOrderStatus(status));
}

export function verifyOrderLookup(
  order: PlacedOrder,
  lookup: { email?: string; phone?: string }
): boolean {
  const email = lookup.email?.trim().toLowerCase();
  const phone = lookup.phone?.replace(/\D/g, "");

  if (email && order.address?.email?.toLowerCase() === email) return true;
  if (phone && order.address?.phone?.replace(/\D/g, "").endsWith(phone.slice(-10))) {
    return true;
  }

  return false;
}
