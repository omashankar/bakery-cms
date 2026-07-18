import type { OrderStatus, PaymentStatus, PlacedOrder } from "@/features/orders/lib/orders";
import { getOrders } from "@/features/orders/lib/orders";

export type OrderStatusFilter = OrderStatus | "all";
export type PaymentStatusFilter = PaymentStatus | "all";

export type OrderDateRange = "all" | "7d" | "30d" | "90d";
export type OrderDeliveryFilter =
  | "all"
  | "pending"
  | "in_progress"
  | "in_transit"
  | "delivered";

export interface OrderListFilters {
  search: string;
  status: OrderStatusFilter;
  payment: PaymentStatusFilter;
  dateRange: OrderDateRange;
  deliveryStatus: OrderDeliveryFilter;
  amountMin: string;
  amountMax: string;
}

export const defaultOrderFilters: OrderListFilters = {
  search: "",
  status: "all",
  payment: "all",
  dateRange: "all",
  deliveryStatus: "all",
  amountMin: "",
  amountMax: "",
};

function matchesDeliveryFilter(status: OrderStatus, filter: OrderDeliveryFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") {
    return ["pending", "confirmed", "preparing", "ready"].includes(status);
  }
  if (filter === "in_progress") {
    return ["pending", "confirmed", "preparing", "ready", "out_for_delivery"].includes(
      status
    );
  }
  if (filter === "in_transit") return status === "out_for_delivery";
  return status === "delivered";
}

function matchesDateRange(placedAt: string, range: OrderDateRange): boolean {
  if (range === "all") return true;
  const placed = new Date(placedAt).getTime();
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return placed >= cutoff;
}

export function countActiveOrderFilters(filters: OrderListFilters): number {
  let count = 0;
  if (filters.deliveryStatus !== "all") count += 1;
  if (filters.amountMin.trim()) count += 1;
  if (filters.amountMax.trim()) count += 1;
  return count;
}

export function filterOrders(
  orders: PlacedOrder[],
  filters: OrderListFilters
): PlacedOrder[] {
  const search = filters.search.trim().toLowerCase();
  const minAmount = filters.amountMin.trim() ? Number(filters.amountMin) : null;
  const maxAmount = filters.amountMax.trim() ? Number(filters.amountMax) : null;

  return orders.filter((order) => {
    if (filters.status !== "all" && order.status !== filters.status) return false;
    if (filters.payment !== "all" && order.paymentStatus !== filters.payment) return false;
    if (!matchesDateRange(order.placedAt, filters.dateRange)) return false;
    if (!matchesDeliveryFilter(order.status, filters.deliveryStatus)) return false;
    if (minAmount !== null && !Number.isNaN(minAmount) && order.totals.total < minAmount) {
      return false;
    }
    if (maxAmount !== null && !Number.isNaN(maxAmount) && order.totals.total > maxAmount) {
      return false;
    }

    if (!search) return true;

    const haystack = [
      order.orderNumber,
      order.address.fullName,
      order.address.email,
      order.address.phone,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(search);
  });
}

export function countOrdersByStatus(
  orders: PlacedOrder[],
  status: OrderStatus
): number {
  return orders.filter((order) => order.status === status).length;
}

export function getOrderStats(orders: PlacedOrder[]) {
  const revenue = orders
    .filter((order) => order.status !== "cancelled" && order.status !== "refunded")
    .reduce((sum, order) => sum + order.totals.total, 0);

  return {
    total: orders.length,
    pending: countOrdersByStatus(orders, "pending"),
    confirmed: countOrdersByStatus(orders, "confirmed"),
    preparing: countOrdersByStatus(orders, "preparing"),
    ready: countOrdersByStatus(orders, "ready"),
    outForDelivery: countOrdersByStatus(orders, "out_for_delivery"),
    delivered: countOrdersByStatus(orders, "delivered"),
    cancelled: countOrdersByStatus(orders, "cancelled"),
    refunded: countOrdersByStatus(orders, "refunded"),
    revenue,
  };
}

export function exportOrdersToCsv(orders: PlacedOrder[]): void {
  if (typeof window === "undefined" || orders.length === 0) return;

  const headers = [
    "Order Number",
    "Customer",
    "Email",
    "Phone",
    "Items",
    "Total",
    "Status",
    "Payment",
    "Placed At",
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.address.fullName,
    order.address.email,
    order.address.phone,
    String(order.items.length),
    String(order.totals.total),
    order.status,
    order.paymentStatus,
    order.placedAt,
  ]);

  const csv = [headers, ...rows]
    .map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `bakery-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ensureDemoOrders(): PlacedOrder[] {
  const existing = getOrders();
  if (existing.length > 0) return existing;

  if (typeof window === "undefined") return [];

  const placedAt = new Date();
  placedAt.setHours(placedAt.getHours() - 6);

  const demoOrders: PlacedOrder[] = [
    {
      id: crypto.randomUUID(),
      orderNumber: "BK-20260708-1042",
      items: [
        {
          id: "demo-1",
          productSlug: "chocolate-truffle",
          name: "Chocolate Truffle Cake",
          image: "/images/cakes/chocolate-truffle.jpg",
          price: 1299,
          quantity: 1,
          weight: "1kg",
          shape: "Round",
          message: "Happy Birthday Rahul!",
        },
      ],
      totals: {
        subtotal: 1299,
        delivery: 99,
        tax: 70,
        discount: 0,
        platformCharge: 0,
        giftWrapFee: 0,
        taxableAmount: 1299,
        total: 1468,
        itemCount: 1,
      },
      address: {
        fullName: "Rahul Sharma",
        email: "rahul@demo.com",
        phone: "+91 98765 43210",
        addressLine1: "123 MG Road",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
      },
      paymentMethod: "upi",
      paymentStatus: "paid",
      paymentReference: "UPI-DEMO-1042",
      placedAt: placedAt.toISOString(),
      status: "preparing",
      statusHistory: [
        { status: "confirmed", at: placedAt.toISOString() },
        {
          status: "preparing",
          at: new Date(placedAt.getTime() + 15 * 60000).toISOString(),
        },
      ],
      estimatedDelivery: new Date(placedAt.getTime() + 86400000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      orderNumber: "BK-20260707-8831",
      items: [
        {
          id: "demo-2",
          productSlug: "red-velvet",
          name: "Red Velvet Cake",
          image: "/images/cakes/red-velvet.jpg",
          price: 899,
          quantity: 1,
          weight: "0.5kg",
          shape: "Heart",
        },
      ],
      totals: {
        subtotal: 899,
        delivery: 99,
        tax: 50,
        discount: 90,
        platformCharge: 0,
        giftWrapFee: 0,
        taxableAmount: 809,
        total: 958,
        itemCount: 1,
      },
      address: {
        fullName: "Priya Mehta",
        email: "priya@demo.com",
        phone: "+91 91234 56789",
        addressLine1: "45 IT Park",
        city: "Pune",
        state: "Maharashtra",
        pincode: "411001",
      },
      paymentMethod: "cod",
      paymentStatus: "cod",
      coupon: { code: "WELCOME10", label: "10% OFF", discountAmount: 90 },
      placedAt: new Date(placedAt.getTime() - 86400000).toISOString(),
      status: "delivered",
      statusHistory: [
        {
          status: "confirmed",
          at: new Date(placedAt.getTime() - 86400000).toISOString(),
        },
        {
          status: "preparing",
          at: new Date(placedAt.getTime() - 82800000).toISOString(),
        },
        {
          status: "out_for_delivery",
          at: new Date(placedAt.getTime() - 43200000).toISOString(),
        },
        {
          status: "delivered",
          at: new Date(placedAt.getTime() - 36000000).toISOString(),
        },
      ],
      estimatedDelivery: new Date(placedAt.getTime() - 36000000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      orderNumber: "BK-20260709-2201",
      items: [
        {
          id: "demo-3",
          productSlug: "butterscotch",
          name: "Butterscotch Crunch",
          image: "/images/cakes/butterscotch.jpg",
          price: 749,
          quantity: 1,
          weight: "0.5kg",
          shape: "Round",
        },
      ],
      totals: {
        subtotal: 749,
        delivery: 99,
        tax: 42,
        discount: 0,
        platformCharge: 0,
        giftWrapFee: 0,
        taxableAmount: 749,
        total: 890,
        itemCount: 1,
      },
      address: {
        fullName: "Ananya Iyer",
        email: "ananya@demo.com",
        phone: "+91 99887 66554",
        addressLine1: "12 Lake View",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560001",
      },
      paymentMethod: "card",
      paymentStatus: "pending",
      placedAt: new Date(placedAt.getTime() - 2 * 3600000).toISOString(),
      status: "pending",
      statusHistory: [
        {
          status: "pending",
          at: new Date(placedAt.getTime() - 2 * 3600000).toISOString(),
        },
      ],
      estimatedDelivery: new Date(placedAt.getTime() + 2 * 86400000).toISOString(),
    },
    {
      id: crypto.randomUUID(),
      orderNumber: "BK-20260709-2208",
      items: [
        {
          id: "demo-4",
          productSlug: "black-forest",
          name: "Black Forest Cake",
          image: "/images/cakes/black-forest.jpg",
          price: 999,
          quantity: 1,
          weight: "1kg",
          shape: "Round",
        },
      ],
      totals: {
        subtotal: 999,
        delivery: 99,
        tax: 55,
        discount: 0,
        platformCharge: 0,
        giftWrapFee: 0,
        taxableAmount: 999,
        total: 1153,
        itemCount: 1,
      },
      address: {
        fullName: "Vikram Singh",
        email: "vikram@demo.com",
        phone: "+91 90123 45678",
        addressLine1: "88 Civil Lines",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
      },
      paymentMethod: "upi",
      paymentStatus: "failed",
      paymentReference: "UPI-FAIL-2208",
      placedAt: new Date(placedAt.getTime() - 4 * 3600000).toISOString(),
      status: "cancelled",
      cancellationReason: "Payment failed",
      statusHistory: [
        {
          status: "pending",
          at: new Date(placedAt.getTime() - 4 * 3600000).toISOString(),
        },
        {
          status: "cancelled",
          at: new Date(placedAt.getTime() - 3.5 * 3600000).toISOString(),
        },
      ],
      estimatedDelivery: new Date(placedAt.getTime() + 86400000).toISOString(),
    },
  ];

  localStorage.setItem("bakery-cms-orders", JSON.stringify(demoOrders));
  window.dispatchEvent(new Event("bakery-orders-updated"));
  return demoOrders;
}
