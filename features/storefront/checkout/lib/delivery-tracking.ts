import type { PlacedOrder } from "./orders";
import { FULFILLMENT_STATUSES } from "./order-status-meta";
import { isTerminalOrderStatus } from "./order-status-meta";

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

function formatTimeWindow(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Soon";

  const start = new Date(date);
  start.setHours(start.getHours() - 1);
  const end = new Date(date);
  end.setHours(end.getHours() + 1);

  const formatter = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

function formatDeliveryDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Date to be confirmed";

  return date.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
  const etaWindow = formatTimeWindow(order.estimatedDelivery);
  const deliveryDate = formatDeliveryDate(order.estimatedDelivery);
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
