import type { PlacedOrder } from "@/features/orders/lib/orders";
import type {
  CustomerActivityItem,
  CustomerAddressSummary,  CustomerSegment,
} from "@/types/customer";
import { getCustomerAdminMeta } from "./customers-repository";
import {
  buildCustomerProfiles,
  type CustomerMeta,
  type CustomerProfile,
} from "@/features/customers/lib/customer-profiles";

// One definition of a customer profile, shared with the server — which builds
// these over every order. See features/customers/lib/customer-profiles.ts.
export {
  deriveCustomerSegment,
  type CustomerProfile,
  type CustomerRecord,
} from "@/features/customers/lib/customer-profiles";
import { getOrders } from "@/features/orders/lib/orders";
import { routes } from "@/constants/routes";

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

/** Takes the customer's orders rather than looking them up — the caller already
 *  has them from the server, and reading the capped local cache here would show
 *  only the addresses used in their most recent orders. */
export function getCustomerAddresses(orders: PlacedOrder[]): CustomerAddressSummary[] {
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

export function getCustomerActivity(
  email: string,
  orders: PlacedOrder[]
): CustomerActivityItem[] {
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

/**
 * Profiles built from the LOCAL order cache.
 *
 * Only for the admin quick-search, which runs per keystroke and must not hit
 * the network. It therefore sees only the most recent slice of orders — every
 * screen that shows a customer total goes to /api/customers instead.
 */
export function getCustomerProfiles(): CustomerProfile[] {
  return buildCustomerProfiles(getOrders(), (key) => getCustomerAdminMeta(key) as CustomerMeta);
}
