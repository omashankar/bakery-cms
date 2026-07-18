import type { PlacedOrder } from "@/features/orders/lib/orders";
import type {
  CustomerActivityItem,
  CustomerAddressSummary,
  CustomerFavoriteProduct,
  CustomerSegment,
} from "@/types/customer";
import { getCustomerAdminMeta } from "./customers-repository";
import type { CustomerRecord } from "./customer-utils";
import {
  buildCustomerRecords,
  getCustomerById,
  getOrdersForCustomerRecord,
} from "./customer-utils";
import { getOrders } from "@/features/orders/lib/orders";
import { routes } from "@/constants/routes";

export interface CustomerProfile extends CustomerRecord {
  segment: CustomerSegment;
  averageOrderValue: number;
  firstOrderAt: string;
  firstOrderNumber: string;
  preferredPaymentMethod: string;
  cities: string[];
  favoriteProducts: CustomerFavoriteProduct[];
  deliveredOrders: number;
  cancelledOrders: number;
  refundedOrders: number;
  activeOrders: number;
  meta: ReturnType<typeof getCustomerAdminMeta>;
}

export type CustomerSpendFilter = "all" | "under_1k" | "1k_5k" | "over_5k";

export interface CustomerListFilters {
  search: string;
  segment: CustomerSegment | "all";
  spend: CustomerSpendFilter;
}

export const defaultCustomerFilters: CustomerListFilters = {
  search: "",
  segment: "all",
  spend: "all",
};

const COUNTABLE_STATUSES = new Set(["cancelled", "refunded"]);

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

export function deriveCustomerSegment(
  customer: CustomerRecord,
  orders: PlacedOrder[]
): CustomerSegment {
  if (customer.orderCount >= 5 || customer.totalSpent >= 5000) {
    return "vip";
  }

  const days = daysSince(customer.lastOrderAt);
  if (days > 90) {
    return customer.orderCount >= 2 ? "at_risk" : "inactive";
  }

  if (customer.orderCount === 1) {
    return "new";
  }

  return "returning";
}

export function formatCustomerSegmentLabel(segment: CustomerSegment): string {
  const labels: Record<CustomerSegment, string> = {
    new: "New",
    returning: "Returning",
    vip: "VIP",
    at_risk: "At risk",
    inactive: "Inactive",
  };
  return labels[segment];
}

export function getCustomerSegmentVariant(
  segment: CustomerSegment
): "accent" | "secondary" | "gold" | "warning" | "outline" {
  if (segment === "vip") return "gold";
  if (segment === "new") return "accent";
  if (segment === "returning") return "secondary";
  if (segment === "at_risk") return "warning";
  return "outline";
}

function getFavoriteProducts(orders: PlacedOrder[]): CustomerFavoriteProduct[] {
  const map = new Map<string, CustomerFavoriteProduct>();

  for (const order of orders) {
    if (COUNTABLE_STATUSES.has(order.status)) continue;

    for (const item of order.items) {
      const current = map.get(item.productSlug) ?? {
        slug: item.productSlug,
        name: item.name,
        quantity: 0,
        revenue: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.price * item.quantity;
      map.set(item.productSlug, current);
    }
  }

  return Array.from(map.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
}

function getPreferredPaymentMethod(orders: PlacedOrder[]): string {
  const counts = new Map<string, number>();

  for (const order of orders) {
    counts.set(order.paymentMethod, (counts.get(order.paymentMethod) ?? 0) + 1);
  }

  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (!top) return "—";

  const [method] = top;
  if (method === "cod") return "Cash on Delivery";
  if (method === "upi") return "UPI";
  if (method === "card") return "Card";
  return method.toUpperCase();
}

function getCustomerCities(orders: PlacedOrder[]): string[] {
  return [...new Set(orders.map((order) => order.address.city).filter(Boolean))].slice(0, 6);
}

function getFirstOrder(orders: PlacedOrder[]): PlacedOrder | null {
  if (orders.length === 0) return null;
  return [...orders].sort(
    (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime()
  )[0];
}

export function buildCustomerProfile(customer: CustomerRecord): CustomerProfile {
  const orders = getOrdersForCustomerRecord(customer.email).sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
  );
  const countableOrders = orders.filter((order) => !COUNTABLE_STATUSES.has(order.status));
  const firstOrder = getFirstOrder(orders);

  return {
    ...customer,
    segment: deriveCustomerSegment(customer, orders),
    averageOrderValue:
      countableOrders.length > 0
        ? Math.round(customer.totalSpent / countableOrders.length)
        : 0,
    firstOrderAt: firstOrder?.placedAt ?? customer.lastOrderAt,
    firstOrderNumber: firstOrder?.orderNumber ?? customer.lastOrderNumber,
    preferredPaymentMethod: getPreferredPaymentMethod(orders),
    cities: getCustomerCities(orders),
    favoriteProducts: getFavoriteProducts(orders),
    deliveredOrders: orders.filter((order) => order.status === "delivered").length,
    cancelledOrders: orders.filter((order) => order.status === "cancelled").length,
    refundedOrders: orders.filter((order) => order.status === "refunded").length,
    activeOrders: orders.filter((order) =>
      ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(order.status)
    ).length,
    meta: getCustomerAdminMeta(customer.email),
  };
}

export function getCustomerProfileById(id: string): CustomerProfile | null {
  const customer = getCustomerById(id);
  if (!customer) return null;
  return buildCustomerProfile(customer);
}

export function getCustomerProfiles(): CustomerProfile[] {
  return buildCustomerRecords(getOrders()).map(buildCustomerProfile);
}

export function getCustomerAddresses(email: string): CustomerAddressSummary[] {
  const orders = getOrdersForCustomerRecord(email);
  const map = new Map<string, CustomerAddressSummary>();

  for (const order of orders) {
    const key = [
      order.address.addressLine1,
      order.address.city,
      order.address.pincode,
    ]
      .join("|")
      .toLowerCase();

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: key,
        label: order.address.addressLine2 || order.address.addressLine1,
        fullName: order.address.fullName,
        phone: order.address.phone,
        city: order.address.city,
        state: order.address.state,
        pincode: order.address.pincode,
        usedCount: 1,
        lastUsedAt: order.placedAt,
      });
      continue;
    }

    map.set(key, {
      ...existing,
      usedCount: existing.usedCount + 1,
      lastUsedAt:
        new Date(order.placedAt).getTime() > new Date(existing.lastUsedAt).getTime()
          ? order.placedAt
          : existing.lastUsedAt,
    });
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
  );
}

export function getCustomerActivity(email: string): CustomerActivityItem[] {
  const orders = getOrdersForCustomerRecord(email);
  const meta = getCustomerAdminMeta(email);
  const items: CustomerActivityItem[] = [];

  for (const order of orders) {
    items.push({
      id: `order-${order.id}`,
      type: "order_placed",
      title: `Order ${order.orderNumber} placed`,
      description: `${order.items.length} item(s) · ${order.status.replace(/_/g, " ")}`,
      at: order.placedAt,
      href: routes.admin.orders.detail(order.id),
    });

    const delivered = order.statusHistory.find((event) => event.status === "delivered");
    if (delivered) {
      items.push({
        id: `delivered-${order.id}`,
        type: "order_delivered",
        title: `Order ${order.orderNumber} delivered`,
        at: delivered.at,
        href: routes.admin.orders.detail(order.id),
      });
    }

    if (order.status === "cancelled") {
      items.push({
        id: `cancelled-${order.id}`,
        type: "order_cancelled",
        title: `Order ${order.orderNumber} cancelled`,
        at: order.placedAt,
        href: routes.admin.orders.detail(order.id),
      });
    }
  }

  if (meta.notes.trim()) {
    items.push({
      id: `note-${meta.updatedAt}`,
      type: "note_updated",
      title: "Admin notes updated",
      description: meta.notes.slice(0, 120),
      at: meta.updatedAt,
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);
}

export function countActiveCustomerFilters(filters: CustomerListFilters): number {
  let count = 0;
  if (filters.search.trim()) count += 1;
  if (filters.segment !== "all") count += 1;
  if (filters.spend !== "all") count += 1;
  return count;
}

export function filterCustomerProfiles(
  customers: CustomerProfile[],
  filters: CustomerListFilters
): CustomerProfile[] {
  const search = filters.search.trim().toLowerCase();

  return customers.filter((customer) => {
    if (filters.segment !== "all" && customer.segment !== filters.segment) return false;

    if (filters.spend === "under_1k" && customer.totalSpent >= 1000) return false;
    if (filters.spend === "1k_5k" && (customer.totalSpent < 1000 || customer.totalSpent > 5000)) {
      return false;
    }
    if (filters.spend === "over_5k" && customer.totalSpent <= 5000) return false;

    if (!search) return true;

    const haystack = [
      customer.name,
      customer.email,
      customer.phone,
      customer.segment,
      ...customer.meta.tags,
      ...customer.cities,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function getCustomerSegmentStats(customers: CustomerProfile[]) {
  return {
    total: customers.length,
    vip: customers.filter((customer) => customer.segment === "vip").length,
    new: customers.filter((customer) => customer.segment === "new").length,
    atRisk: customers.filter((customer) => customer.segment === "at_risk").length,
    marketingOptIn: customers.filter((customer) => customer.meta.marketingOptIn).length,
  };
}

export function exportCustomersToCsv(customers: CustomerProfile[]): void {
  if (typeof window === "undefined" || customers.length === 0) return;

  const headers = [
    "Name",
    "Email",
    "Phone",
    "Segment",
    "Orders",
    "Total Spent",
    "AOV",
    "Last Order",
    "Marketing Opt-in",
    "Tags",
    "Notes",
  ];

  const rows = customers.map((customer) => [
    customer.name,
    customer.email,
    customer.phone,
    formatCustomerSegmentLabel(customer.segment),
    String(customer.orderCount),
    String(customer.totalSpent),
    String(customer.averageOrderValue),
    customer.lastOrderAt,
    customer.meta.marketingOptIn ? "Yes" : "No",
    customer.meta.tags.join("; "),
    customer.meta.notes,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-customers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
