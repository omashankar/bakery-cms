import type { OrderStatus } from "./orders";

/**
 * What a member who is NOT trusted with the whole order list may see and do.
 *
 * `orders.view` is the whole list, with prices, payment and the customer's
 * details. Two narrower permissions exist for the people who make and deliver
 * the cakes:
 *
 * - `orders.view_kitchen` — the queue of orders to make, and the two moves the
 *   kitchen makes: started, and ready.
 * - `orders.view_assigned` — only the orders assigned to THIS person for
 *   delivery, and the two moves a rider makes: picked up, and delivered.
 *
 * Pure and shared: the server enforces these rules, and the Kitchen and
 * Deliveries screens read the same ones to decide which buttons to draw.
 */

export const KITCHEN_QUEUE_STATUSES = ["confirmed", "preparing", "ready"] as const satisfies readonly OrderStatus[];

/**
 * An assigned order is on the rider's list from the moment it is theirs until
 * it is delivered — a shop assigns the rider while the cake is still being made,
 * and the rider plans their round from that. They can only MOVE it once the
 * kitchen has marked it ready (see DELIVERY_MOVES).
 */
export const DELIVERY_ACTIVE_STATUSES = [
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
] as const satisfies readonly OrderStatus[];

/** How long a delivered order stays on the rider's list, so they can see what they finished today. */
export const DELIVERED_VISIBLE_FOR_MS = 24 * 60 * 60 * 1000;

const KITCHEN_MOVES: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  // A shop that marks a cake Ready without marking it Preparing has still made it.
  confirmed: ["preparing", "ready"],
  preparing: ["ready"],
};

const DELIVERY_MOVES: Partial<Record<OrderStatus, readonly OrderStatus[]>> = {
  ready: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
};

export interface StatusScope {
  /** `orders.view` — every order, every move the order rules allow. */
  all: boolean;
  /** `orders.view_kitchen`. */
  kitchen: boolean;
  /** `orders.view_assigned` — the member's own user id, or null. */
  deliveriesOf: string | null;
}

export function statusScopeFor(permissions: ReadonlySet<string>, userId: string): StatusScope {
  return {
    all: permissions.has("orders.view"),
    kitchen: permissions.has("orders.view_kitchen"),
    deliveriesOf: permissions.has("orders.view_assigned") ? userId : null,
  };
}

export interface ScopedOrder {
  status: OrderStatus;
  deliveryPartner?: { userId?: string } | null;
}

export function isAssignedTo(order: ScopedOrder, userId: string | null): boolean {
  return Boolean(userId && order.deliveryPartner?.userId && order.deliveryPartner.userId === userId);
}

/** The moves the KITCHEN may make on this order — whether or not it is in the queue. */
export function kitchenMoves(order: ScopedOrder): readonly OrderStatus[] {
  return KITCHEN_MOVES[order.status] ?? [];
}

/** The moves a rider may make on this order — only if it is theirs. */
export function deliveryMoves(order: ScopedOrder, userId: string | null): readonly OrderStatus[] {
  if (!isAssignedTo(order, userId)) return [];
  return DELIVERY_MOVES[order.status] ?? [];
}

/**
 * Whether a member limited to the kitchen queue or their own deliveries may
 * move this order to `to`. Members with `orders.view` are not judged here —
 * the order rules (`orderStatusTransitionError`) are the whole answer for them.
 */
export function scopedMoveAllowed(scope: StatusScope, order: ScopedOrder, to: OrderStatus): boolean {
  if (scope.kitchen && kitchenMoves(order).includes(to)) return true;
  if (scope.deliveriesOf && deliveryMoves(order, scope.deliveriesOf).includes(to)) return true;
  return false;
}

/** Whether a scoped member may see this order at all. */
export function scopedOrderVisible(scope: StatusScope, order: ScopedOrder): boolean {
  if (scope.all) return true;
  if (scope.kitchen && (KITCHEN_QUEUE_STATUSES as readonly string[]).includes(order.status)) return true;
  return isAssignedTo(order, scope.deliveriesOf);
}
