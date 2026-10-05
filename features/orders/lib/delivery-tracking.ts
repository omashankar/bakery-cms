import type { DeliveryPartner, PlacedOrder } from "@/features/orders/lib/orders";
import { formatCalendarDate, formatDate } from "@/utils/format";
import { FULFILLMENT_STATUSES } from "@/features/orders/lib/order-status-meta";
import { isTerminalOrderStatus } from "@/features/orders/lib/order-status-meta";

/**
 * The rider on this order, or nobody.
 *
 * There used to be a DELIVERY_PARTNERS list here: three invented people —
 * "Ravi Kumar, +91 98765 43210, Delivery scooter, 4.9" and two others — and
 * `pickPartner` chose one by hashing the order id. Every order therefore had a
 * courier with a name, a phone number a customer could actually ring, and a
 * star rating for a delivery that had not happened yet. The card carrying it
 * said "Demo assignment for frontend preview" in small grey text at the bottom,
 * which is not a disclaimer a customer reads before dialling.
 *
 * A shop that has not assigned anyone shows no card. That is the honest answer,
 * and it is also the one that makes assigning somebody mean something.
 */
export interface DeliveryTrackingSnapshot {
  progressPercent: number;
  etaHeadline: string;
  etaDetail: string;
  etaWindow: string;
  showPartner: boolean;
  partner: DeliveryPartner | null;
  /**
   * Where the order is going — a city and a pincode from the order's own
   * address.
   *
   * Called `mapLabel` while a fake map was the thing that displayed it. There
   * is no map now, and there never was one: the panel showed CSS gridlines, a
   * pill reading "Demo map", two pins joined by a dashed line, and the
   * sentence "Real-time GPS will be available with a live backend" — a
   * developer's note, shipped to a paying customer on the order they had just
   * paid for. `showLiveMap` sat beside this field to decide when to animate it.
   *
   * The repo holds no courier position, no route and no tracking provider, so
   * there was nothing honest to put in its place. The address itself is real,
   * and `DeliveryEstimatedCard` already prints it under "Delivering to".
   */
  destinationLabel: string;
  /**
   * The delivery date to show, or null when promising one would be a lie.
   *
   * The order page printed "Estimated delivery: 16 Aug 2026" with no status
   * guard at all, so a CANCELLED order read "Order cancelled" and a delivery
   * date one line below it. The decision lives here because every other
   * terminal-status decision on that screen already does — `etaWindow` is
   * already "—" for a cancelled order, eight lines down.
   */
  deliveryDateLine: string | null;
  statusMessage: string;
}

/**
 * The window under "Time window" on the tracking page.
 *
 * The slot the customer picked at checkout, because that is the promise the
 * shop made — "2:00 PM – 4:00 PM", one of the windows the admin configured and
 * the server validated the order against.
 *
 * It used to be derived from `estimatedDelivery` by taking an hour either side
 * of it, and `estimatedDelivery` for a slot-booked order is
 * `new Date("2026-08-16").toISOString()` — a bare date, parsed as UTC midnight.
 * In IST that renders as 5:30 AM, so the page told a customer who had booked
 * an afternoon slot that their cake would arrive between 4:30 and 6:30 in the
 * morning. It contradicted the order confirmation, the invoice and the slot
 * they had chosen, and the number came from a timezone offset.
 *
 * With no booked slot there is no window: the shop has agreed a DAY, not a
 * time, and inventing a two-hour range around midnight-plus-an-offset is how
 * this went wrong in the first place.
 */
function resolveEtaWindow(order: PlacedOrder): string {
  const booked = order.deliverySlot?.timeSlot?.trim();
  if (booked) return booked;

  return "To be confirmed";
}

/**
 * The day the cake arrives.
 *
 * The BOOKED date when there is one, formatted as a calendar day. It used to
 * come from `estimatedDelivery` via `toLocaleDateString` with no timezone,
 * which for a slot-booked order is midnight UTC of the chosen day — the day
 * before, anywhere west of UTC, and in whatever zone the rendering machine
 * happened to be in rather than the shop's.
 */
export function formatOrderDeliveryDay(
  order: Pick<PlacedOrder, "deliverySlot" | "estimatedDelivery">,
  options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    day: "numeric",
    month: "long",
  },
): string {
  const booked = order.deliverySlot?.date?.trim();
  if (booked) return formatCalendarDate(booked, options);

  const date = new Date(order.estimatedDelivery);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";

  // A real instant — `now + estimatedDeliveryDays` — so it renders in the
  // shop's own timezone.
  return formatDate(order.estimatedDelivery, options);
}

export function getDeliveryProgressPercent(order: PlacedOrder): number {
  if (order.status === "delivered") return 100;
  if (isTerminalOrderStatus(order.status)) return 0;

  const index = FULFILLMENT_STATUSES.indexOf(order.status);
  if (index === -1) return 10;
  return Math.round(((index + 1) / FULFILLMENT_STATUSES.length) * 100);
}

export function getDeliveryTrackingSnapshot(order: PlacedOrder): DeliveryTrackingSnapshot {
  const progressPercent = getDeliveryProgressPercent(order);
  const partner = order.deliveryPartner ?? null;
  const etaWindow = resolveEtaWindow(order);
  const deliveryDate = formatOrderDeliveryDay(order);
  /**
   * The same day, in the short form the order page has always printed.
   *
   * `deliveryDate` above reads inside a sentence ("Expected on Sunday, 16
   * August"); this one stands alone on its own line as "16 Aug 2026". Computed
   * here rather than at the call site only so the null-on-a-cancelled-order
   * decision and the formatting live together.
   */
  const deliveryDateShort = formatOrderDeliveryDay(order, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const destinationLabel = `${order.address.city}, ${order.address.pincode}`;

  if (order.status === "delivered") {
    return {
      progressPercent: 100,
      etaHeadline: "Delivered",
      etaDetail: `Your order arrived on ${deliveryDate}.`,
      etaWindow,
      // It arrived. The line above says when; a second 'estimated' one
      // beside it would be predicting the past.
      deliveryDateLine: null,
      showPartner: Boolean(partner),
      partner,
      destinationLabel,
      statusMessage: "We hope everything arrived just right.",
    };
  }

  if (order.status === "cancelled") {
    return {
      progressPercent: 0,
      etaHeadline: "Order cancelled",
      etaDetail: order.cancellationReason ?? "This delivery will not be completed.",
      etaWindow: "—",
      deliveryDateLine: null,
      showPartner: false,
      partner: null,
      destinationLabel,
      statusMessage: "Contact support if you need help with a refund.",
    };
  }

  if (order.status === "refunded") {
    return {
      progressPercent: 0,
      etaHeadline: "Refund processed",
      etaDetail: "A refund has been issued for this order.",
      etaWindow: "—",
      deliveryDateLine: null,
      showPartner: false,
      partner: null,
      destinationLabel,
      statusMessage: order.refundReference
        ? `Reference: ${order.refundReference}`
        : "Check your email for refund confirmation.",
    };
  }

  if (order.status === "out_for_delivery") {
    return {
      progressPercent,
      etaHeadline: "Out for delivery",
      // Named only when the bakery has said who. It used to read "Ravi Kumar is
      // on the way with your cakes" for every order, about a person the shop
      // has never employed.
      etaDetail: partner
        ? `${partner.name} is on the way with your order.`
        : "Your order is on its way.",
      etaWindow,
      deliveryDateLine: deliveryDateShort,
      showPartner: Boolean(partner),
      partner,
      destinationLabel,
      statusMessage: "Keep your phone nearby — we may call before arrival.",
    };
  }

  if (order.status === "ready") {
    return {
      progressPercent,
      etaHeadline: "Ready to dispatch",
      etaDetail: `Scheduled for ${deliveryDate}.`,
      etaWindow,
      deliveryDateLine: deliveryDateShort,
      showPartner: Boolean(partner),
      partner,
      destinationLabel,
      statusMessage: "Your order is packed and will be handed to our delivery partner soon.",
    };
  }

  return {
    progressPercent,
    etaHeadline: "Estimated delivery",
    etaDetail: `Expected on ${deliveryDate}.`,
    etaWindow,
    deliveryDateLine: deliveryDateShort,
    showPartner: false,
    partner: null,
    destinationLabel,
    statusMessage:
      order.status === "preparing"
        ? "We are preparing your order now."
        : "We will notify you when your order is out for delivery.",
  };
}
