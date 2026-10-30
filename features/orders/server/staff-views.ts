import type { PlacedOrder } from "@/features/orders/lib/orders";
import type {
  DeliveryOrderView,
  KitchenOrderView,
  StaffItemView,
} from "@/features/orders/lib/staff-order-types";

export type { DeliveryOrderView, KitchenOrderView, StaffItemView };

/**
 * The order as the KITCHEN and a RIDER are allowed to see it.
 *
 * ALLOW-lists, deliberately — the opposite choice from `withoutStaffOnlyFields`,
 * which strips internal notes from the customer's copy. A deny-list fails OPEN:
 * the day somebody adds `totals.profit` or `paymentMeta` to an order, a deny-list
 * hands it to the kitchen. Here a field reaches the browser only because a line
 * below names it, so a new field stays private until someone decides otherwise.
 *
 * What is never here: prices, totals, the coupon, payment method, status and
 * reference, refund records, internal admin notes, the customer's email, and
 * the sender's name and phone on a gift (the sender may have asked to stay
 * anonymous — the recipient is who the rider meets).
 */

function pick<T extends object, K extends keyof T>(source: T, keys: readonly K[]): Partial<Pick<T, K>> {
  const out: Partial<Pick<T, K>> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && value !== "") out[key] = value;
  }
  return out;
}

function itemView(item: PlacedOrder["items"][number]): StaffItemView {
  return {
    id: item.id,
    name: item.name,
    image: item.image ?? "",
    quantity: item.quantity,
    ...pick(item, [
      "weight",
      "weightLabel",
      "flavour",
      "shape",
      "message",
      "photoUrl",
      "deliveryDate",
      "deliveryTime",
      "variantSummary",
    ] as const),
  };
}

export function toKitchenView(order: PlacedOrder): KitchenOrderView {
  const slot = order.deliverySlot;
  const personalisation = order.personalisation
    ? pick(order.personalisation, ["occasion", "message"] as const)
    : undefined;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    statusHistory: (order.statusHistory ?? []).map((e) => ({ status: e.status, at: e.at })),
    placedAt: order.placedAt,
    estimatedDelivery: order.estimatedDelivery ?? "",
    ...(slot
      ? {
          deliverySlot: {
            date: slot.date,
            timeSlot: slot.timeSlot,
            ...(slot.tierLabel ? { tierLabel: slot.tierLabel } : {}),
          },
        }
      : {}),
    ...(order.orderNotes ? { orderNotes: order.orderNotes } : {}),
    ...(personalisation && Object.keys(personalisation).length > 0 ? { personalisation } : {}),
    items: (order.items ?? []).map(itemView),
  };
}

export function toDeliveryView(order: PlacedOrder): DeliveryOrderView {
  const a = order.address;
  const location =
    a?.location && typeof a.location.lat === "number" && typeof a.location.lng === "number"
      ? { lat: a.location.lat, lng: a.location.lng }
      : undefined;
  const partner = order.deliveryPartner;
  const unpaidCash = order.paymentMethod === "cod" && order.paymentStatus !== "paid";
  return {
    ...toKitchenView(order),
    address: {
      fullName: a?.fullName ?? "",
      phone: a?.phone ?? "",
      addressLine1: a?.addressLine1 ?? "",
      city: a?.city ?? "",
      state: a?.state ?? "",
      pincode: a?.pincode ?? "",
      ...(a ? pick(a, ["altPhone", "addressLine2", "landmark"] as const) : {}),
      ...(location ? { location } : {}),
    },
    ...(partner?.name
      ? { deliveryPartner: { name: partner.name, ...pick(partner, ["phone", "vehicle"] as const) } }
      : {}),
    cashToCollect: unpaidCash ? Number(order.totals?.total) || 0 : 0,
  };
}
