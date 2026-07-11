import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { getOrders } from "@/features/storefront/checkout/lib/orders";

export interface CustomerRecord {
  id: string;
  email: string;
  name: string;
  phone: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
  lastOrderNumber: string;
}

export type { CustomerListFilters } from "./customer-profile-utils";
export { defaultCustomerFilters } from "./customer-profile-utils";

export function buildCustomerRecords(orders: PlacedOrder[]): CustomerRecord[] {
  const map = new Map<string, CustomerRecord>();

  for (const order of orders) {
    const email = order.address.email.trim().toLowerCase();
    const existing = map.get(email);

    if (!existing) {
      map.set(email, {
        id: email,
        email: order.address.email,
        name: order.address.fullName,
        phone: order.address.phone,
        orderCount: 1,
        totalSpent: order.totals.total,
        lastOrderAt: order.placedAt,
        lastOrderNumber: order.orderNumber,
      });
      continue;
    }

    map.set(email, {
      ...existing,
      name: order.address.fullName || existing.name,
      phone: order.address.phone || existing.phone,
      orderCount: existing.orderCount + 1,
      totalSpent: existing.totalSpent + order.totals.total,
      lastOrderAt:
        new Date(order.placedAt).getTime() > new Date(existing.lastOrderAt).getTime()
          ? order.placedAt
          : existing.lastOrderAt,
      lastOrderNumber:
        new Date(order.placedAt).getTime() > new Date(existing.lastOrderAt).getTime()
          ? order.orderNumber
          : existing.lastOrderNumber,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime()
  );
}

export function getCustomerRecords(): CustomerRecord[] {
  return buildCustomerRecords(getOrders());
}

export function getCustomerById(id: string): CustomerRecord | null {
  const normalized = decodeURIComponent(id).trim().toLowerCase();
  return getCustomerRecords().find((customer) => customer.id === normalized) ?? null;
}

export function getOrdersForCustomerRecord(email: string): PlacedOrder[] {
  const normalized = email.trim().toLowerCase();
  return getOrders().filter(
    (order) => order.address.email.trim().toLowerCase() === normalized
  );
}

export {
  countActiveCustomerFilters,
  exportCustomersToCsv,
  filterCustomerProfiles,
  getCustomerProfiles,
  getCustomerProfileById,
  getCustomerSegmentStats,
} from "./customer-profile-utils";

export type { CustomerProfile, CustomerSpendFilter } from "./customer-profile-utils";
