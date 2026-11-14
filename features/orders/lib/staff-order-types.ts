import type { OrderStatus, OrderStatusEvent } from "./orders";

/**
 * What the kitchen and a rider are sent — see features/orders/server/staff-views.ts,
 * which builds these from an ALLOW-list. Types only, so the screens can import
 * them without reaching into a server module.
 */

export interface StaffItemView {
  id: string;
  name: string;
  image: string;
  quantity: number;
  weight?: string;
  weightLabel?: string;
  flavour?: string;
  shape?: string;
  message?: string;
  photoUrl?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  variantSummary?: string[];
}

export interface KitchenOrderView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  statusHistory: OrderStatusEvent[];
  placedAt: string;
  estimatedDelivery: string;
  deliverySlot?: { date: string; timeSlot: string; tierLabel?: string };
  /** What the customer asked for — "less sugar", "no nuts". */
  orderNotes?: string;
  /** The occasion and the message for the cake. */
  personalisation?: { occasion?: string; message?: string };
  items: StaffItemView[];
}

export interface DeliveryOrderView extends KitchenOrderView {
  address: {
    fullName: string;
    phone: string;
    altPhone?: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state: string;
    pincode: string;
    location?: { lat: number; lng: number };
  };
  deliveryPartner?: { name: string; phone?: string; vehicle?: string };
  /**
   * Cash the rider must collect at the door — the one money figure a rider
   * needs to do the job. Zero for anything already paid.
   */
  cashToCollect: number;
}

