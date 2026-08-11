import type { PlacedOrder } from "@/features/orders/lib/orders";
import { formatCalendarDate, formatDate } from "@/utils/format";
import { FULFILLMENT_STATUSES } from "@/features/orders/lib/order-status-meta";
import { isTerminalOrderStatus } from "@/features/orders/lib/order-status-meta";

export interface DeliveryPartnerInfo {
  name: string;
  phone: string;
  vehicle: string;
  rating: number;
  partnerId: string;
}

export interface DeliveryTrackingSnapshot {
  progressPercent: number;
  etaHeadline: string;
  etaDetail: string;
  etaWindow: string;
  showLiveMap: boolean;
  showPartner: boolean;
  partner: DeliveryPartnerInfo | null;
  mapLabel: string;
  statusMessage: string;
}

const DELIVERY_PARTNERS: DeliveryPartnerInfo[] = [
  {
    partnerId: "dp-01",
    name: "Ravi Kumar",
    phone: "+91 98765 43210",
    vehicle: "Delivery scooter",
    rating: 4.9,
  },
  {
    partnerId: "dp-02",
    name: "Sneha Nair",
    phone: "+91 91234 56780",
    vehicle: "Refrigerated van",
    rating: 4.8,
  },
  {
    partnerId: "dp-03",
    name: "Imran Sheikh",
    phone: "+91 99887 76655",
    vehicle: "Bike courier",
    rating: 4.7,
  },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickPartner(order: PlacedOrder): DeliveryPartnerInfo {
  return DELIVERY_PARTNERS[hashString(order.id) % DELIVERY_PARTNERS.length];
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
  const partner = pickPartner(order);
  const etaWindow = resolveEtaWindow(order);
  const deliveryDate = formatOrderDeliveryDay(order);
  const mapLabel = `${order.address.city}, ${order.address.pincode}`;

  if (order.status === "delivered") {
    return {
      progressPercent: 100,
      etaHeadline: "Delivered",
      etaDetail: `Your order arrived on ${deliveryDate}.`,
      etaWindow,
      showLiveMap: false,
      showPartner: true,
      partner,
      mapLabel,
      statusMessage: "Hope your celebration was as sweet as our cakes.",
    };
  }

  if (order.status === "cancelled") {
    return {
      progressPercent: 0,
      etaHeadline: "Order cancelled",
      etaDetail: order.cancellationReason ?? "This delivery will not be completed.",
      etaWindow: "—",
      showLiveMap: false,
      showPartner: false,
      partner: null,
      mapLabel,
      statusMessage: "Contact support if you need help with a refund.",
    };
  }

  if (order.status === "refunded") {
    return {
      progressPercent: 0,
      etaHeadline: "Refund processed",
      etaDetail: "A refund has been issued for this order.",
      etaWindow: "—",
      showLiveMap: false,
      showPartner: false,
      partner: null,
      mapLabel,
      statusMessage: order.refundReference
        ? `Reference: ${order.refundReference}`
        : "Check your email for refund confirmation.",
    };
  }

  if (order.status === "out_for_delivery") {
    return {
      progressPercent,
      etaHeadline: "Out for delivery",
      etaDetail: `${partner.name} is on the way with your cakes.`,
      etaWindow,
      showLiveMap: true,
      showPartner: true,
      partner,
      mapLabel,
      statusMessage: "Keep your phone nearby — we may call before arrival.",
    };
  }

  if (order.status === "ready") {
    return {
      progressPercent,
      etaHeadline: "Ready to dispatch",
      etaDetail: `Scheduled for ${deliveryDate}.`,
      etaWindow,
      showLiveMap: false,
      showPartner: true,
      partner,
      mapLabel,
      statusMessage: "Your cake is packed and will be handed to our delivery partner soon.",
    };
  }

  return {
    progressPercent,
    etaHeadline: "Estimated delivery",
    etaDetail: `Expected on ${deliveryDate}.`,
    etaWindow,
    showLiveMap: false,
    showPartner: false,
    partner: null,
    mapLabel,
    statusMessage:
      order.status === "preparing"
        ? "Our bakers are preparing your order fresh."
        : "We will notify you when your order is out for delivery.",
  };
}
