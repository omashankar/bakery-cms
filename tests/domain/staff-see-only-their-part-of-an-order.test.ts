/**
 * KITCHEN STAFF AND RIDERS SEE ONLY THEIR PART OF AN ORDER.
 *
 * Hiding a column in the browser is not privacy: whatever the API sends is in
 * the network tab. So the kitchen's and a rider's views are built from an
 * ALLOW-list on the server, and these check what actually leaves it — the money,
 * the customer's email and the internal notes must not, and the address and the
 * cash to collect must, for a rider.
 *
 * And two shared reads that every member gets are trimmed for the member: the
 * analytics (people, not money, need their own permission) and the settings
 * (the mail server is configuration, not something every screen needs).
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/settings/server/settings.service", () => ({}));
vi.mock("@/lib/server/mail/send-test-email", () => ({ sendTestEmail: vi.fn() }));

import { toDeliveryView, toKitchenView } from "@/features/orders/server/staff-views";
import { analyticsForViewer, type OrderAnalytics } from "@/features/orders/server/order.analytics";
import { settingsForActor } from "@/features/settings/server/settings.controller";
import type { PlacedOrder } from "@/features/orders/lib/orders";

const ORDER = {
  id: "o1",
  orderNumber: "BK-1",
  items: [
    {
      id: "l1",
      productSlug: "choc",
      name: "Chocolate Truffle",
      image: "/c.jpg",
      price: 899,
      compareAtPrice: 999,
      quantity: 1,
      weightLabel: "1 kg",
      flavour: "Chocolate",
      message: "Happy Birthday Riya",
    },
  ],
  totals: { subtotal: 899, total: 948, deliveryFee: 49 },
  address: {
    fullName: "Riya Sharma",
    email: "riya@example.com",
    phone: "9876543210",
    altPhone: "9123456780",
    addressLine1: "12 MG Road",
    landmark: "Opposite the temple",
    city: "Kota",
    state: "Rajasthan",
    pincode: "324001",
    location: { lat: 25.18, lng: 75.83 },
  },
  paymentMethod: "cod",
  paymentStatus: "cod",
  paymentReference: "pay_secret",
  coupon: { code: "BDAY10", discount: 50 },
  orderNotes: "Less sugar please",
  personalisation: {
    occasion: "Birthday",
    message: "From all of us",
    sender: { name: "Aman", phone: "9000000000", hidden: true },
  },
  placedAt: "2026-10-30T08:00:00.000Z",
  status: "ready",
  statusHistory: [{ status: "confirmed", at: "2026-10-30T08:00:00.000Z" }],
  estimatedDelivery: "Today",
  deliverySlot: { date: "2026-10-30", timeSlot: "4–6 PM" },
  adminNotes: "Customer complained last time",
  deliveryPartner: { name: "Ravi", phone: "9988776655", userId: "r1" },
  refundRecord: { status: "requested", notes: "internal" },
} as unknown as PlacedOrder;

function json(value: unknown): string {
  return JSON.stringify(value);
}

describe("the kitchen's view", () => {
  const view = toKitchenView(ORDER);
  const wire = json(view);

  it("carries what to make and the instructions", () => {
    expect(view.items[0]).toMatchObject({ name: "Chocolate Truffle", quantity: 1, weightLabel: "1 kg", message: "Happy Birthday Riya" });
    expect(view.orderNotes).toBe("Less sugar please");
    expect(view.personalisation).toEqual({ occasion: "Birthday", message: "From all of us" });
    expect(view.deliverySlot).toEqual({ date: "2026-10-30", timeSlot: "4–6 PM" });
  });

  it("carries no money, no payment, no customer contact, no internal notes", () => {
    for (const secret of ["899", "948", "999", "riya@example.com", "9876543210", "12 MG Road", "pay_secret", "BDAY10", "complained", "Aman", "9000000000", "internal", "cod"]) {
      expect(wire, `kitchen view leaks "${secret}"`).not.toContain(secret);
    }
    expect(view).not.toHaveProperty("totals");
    expect(view).not.toHaveProperty("address");
    expect(view).not.toHaveProperty("paymentStatus");
  });
});

describe("a rider's view", () => {
  const view = toDeliveryView(ORDER);
  const wire = json(view);

  it("carries where to go, who to call and what to collect", () => {
    expect(view.address).toMatchObject({
      fullName: "Riya Sharma",
      phone: "9876543210",
      altPhone: "9123456780",
      addressLine1: "12 MG Road",
      landmark: "Opposite the temple",
      location: { lat: 25.18, lng: 75.83 },
    });
    expect(view.cashToCollect).toBe(948);
  });

  it("carries no email, prices, payment reference, coupon, sender or internal notes", () => {
    for (const secret of ["riya@example.com", "899", "999", "pay_secret", "BDAY10", "complained", "Aman", "9000000000", "internal"]) {
      expect(wire, `rider view leaks "${secret}"`).not.toContain(secret);
    }
    expect(view).not.toHaveProperty("totals");
  });

  it("asks for nothing at the door when the order is already paid", () => {
    expect(toDeliveryView({ ...ORDER, paymentMethod: "razorpay", paymentStatus: "paid" } as PlacedOrder).cashToCollect).toBe(0);
    expect(toDeliveryView({ ...ORDER, paymentStatus: "paid" } as PlacedOrder).cashToCollect).toBe(0);
  });

  it("a field added to orders later does not reach the rider unless someone lists it", () => {
    const withNewField = { ...ORDER, profitMargin: 412, internalRating: "difficult" } as unknown as PlacedOrder;
    const out = json(toDeliveryView(withNewField));
    expect(out).not.toContain("412");
    expect(out).not.toContain("difficult");
  });
});

describe("analytics are revenue — the people in them need their own permission", () => {
  const analytics = {
    topCustomers: [{ email: "riya@example.com", name: "Riya", orders: 3, revenue: 2400 }],
    recentOrders: [ORDER],
    summary: { revenue: 1 },
  } as unknown as OrderAnalytics;

  it("someone with revenue but not customers or orders gets the figures without the names", () => {
    const out = analyticsForViewer(analytics, new Set(["reports.revenue.view"]));
    expect(out.topCustomers).toEqual([]);
    expect(out.recentOrders).toEqual([]);
    expect(out.summary).toEqual({ revenue: 1 });
  });

  it("someone with all three gets all of it", () => {
    const out = analyticsForViewer(analytics, new Set(["reports.revenue.view", "customers.view", "orders.view"]));
    expect(out.topCustomers).toHaveLength(1);
    expect(out.recentOrders).toHaveLength(1);
  });
});

describe("the settings every screen reads", () => {
  const settings = {
    general: { siteName: "Cake Shop" },
    smtp: { host: "smtp.example.com", user: "mailer@example.com", password: "hunter2" },
  } as never;

  it("never carries the mail password, to anyone", () => {
    const full = settingsForActor(settings, { permissions: new Set(["settings.view"]) as never });
    expect(json(full)).not.toContain("hunter2");
    expect(json(full)).toContain("smtp.example.com");
  });

  it("leaves the mail server out entirely for a member without settings.view", () => {
    const trimmed = settingsForActor(settings, { permissions: new Set(["orders.view_kitchen"]) as never });
    expect(trimmed).not.toHaveProperty("smtp");
    expect(json(trimmed)).toContain("Cake Shop");
  });
});
