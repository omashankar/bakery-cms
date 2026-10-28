import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AN ORDER CANNOT SKIP THE MAP PIN.
 *
 * Found in the zone review (2026-10-28): pricing checks the pin only for a
 * WHOLE address (one with a street line). A quote sent with just a city and
 * PIN was priced at the fallback fee — even with "deliver outside zones" off
 * — and placing the order with that quote and no pin went through, because
 * the address guard compared "no pin" with "no pin" and called them the same.
 * Now, with delivery zones on, an order is placed only for a pin the server
 * checked.
 */

const state = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  draft: null as Record<string, unknown> | null,
}));

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async (slug: string) => ({ slug, name: "Truffle", price: 500, image: "/t.jpg", category: "Cakes", weights: [], allowsPhotoUpload: false }),
  listBySlugs: async () => [],
  patch: async () => null,
}));
vi.mock("@/features/settings/server/settings.service", async () => {
  const { defaultCommerceSettings } = await import("@/features/settings/lib/settings-utils");
  return {
    getSettings: async () => ({
      commerce: {
        ...defaultCommerceSettings,
        useZoneBasedDelivery: true,
        deliverOutsideZones: false,
        deliveryFee: 99,
        zoneFallbackDeliveryFee: 149,
        freeDeliveryThreshold: 0,
        platformChargeEnabled: false,
        giftWrapEnabled: false,
        minOrderValue: 0,
        deliveryLeadDays: 0,
      },
      general: { currency: "INR" },
    }),
  };
});
vi.mock("@/features/commerce/server/commerce.service", () => ({
  getCoupons: async () => [],
  getZones: async () => [],
}));
vi.mock("@/features/commerce/server/commerce.repository", () => ({
  incrementCouponUsage: async () => undefined,
  decrementCouponUsage: async () => undefined,
}));
vi.mock("@/features/orders/server/order.repository", () => ({
  findByPaymentReference: async () => null,
  findById: async () => null,
  orderNumberExists: async () => false,
  createOrderWithStockReduction: async (order: Record<string, unknown>) => {
    state.inserted = order;
    return { kind: "created", order };
  },
  restoreStock: async () => undefined,
  patch: async () => null,
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async () => undefined,
  requestContext: () => ({}),
}));
vi.mock("@/features/payments/server/unclaimed-payment.repository", () => ({
  resolveUnclaimedPayment: async () => undefined,
}));
vi.mock("@/features/checkout/server/draft.repository", () => ({
  findDraft: async () => state.draft,
  consumeDraft: async () => true,
  claimDraft: async () => state.draft,
}));

import { placeOrder } from "@/features/orders/server/order.service";

const KOTA = { lat: 25.1467, lng: 75.8407 };
const address = {
  fullName: "Asha Menon",
  email: "asha@example.com",
  phone: "+91 90000 00000",
  addressLine1: "1 Talwandi Road",
  city: "Kota",
  state: "Rajasthan",
  pincode: "324005",
};
const items = [{ productSlug: "truffle", name: "Truffle", price: 500, quantity: 1 }];

function draft(totals: Record<string, unknown>, deliveryAddress: Record<string, unknown>) {
  return {
    id: "d1",
    items,
    totals: { subtotal: 500, tax: 0, itemCount: 1, ...totals },
    deliveryAddress,
    createdAt: new Date().toISOString(),
  };
}

beforeEach(() => {
  state.inserted = null;
  state.draft = null;
});

describe("placing an order on a shop with delivery zones", () => {
  it("refuses a quote priced with no pin — the fallback-fee hole", async () => {
    // What /api/checkout/quote returned for { city, pincode } and no street: fallback fee, no pin.
    state.draft = draft({ delivery: 149, total: 649 }, { city: "Kota", pincode: "324005" });
    const refusal = await placeOrder({ items, totals: { subtotal: 500, total: 649, itemCount: 1 }, address, paymentMethod: "cod", draftId: "d1" } as never, {} as never).catch(
      (error: unknown) => error,
    );
    expect(refusal).toMatchObject({ status: 409 });
    expect(String((refusal as Error).message)).toMatch(/pin your delivery location/i);
    expect(state.inserted).toBeNull();
  });

  it("places a quote whose pin the server checked", async () => {
    const pin = { ...KOTA, postalCode: "324005", pincodeCheck: "matched", formattedAddress: "Talwandi, Kota", zoneId: "k", verifiedAt: "" };
    state.draft = draft({ delivery: 99, total: 599, deliveryPin: pin }, { city: "Kota", pincode: "324005", location: KOTA });
    await placeOrder(
      { items, totals: { subtotal: 500, total: 599, itemCount: 1 }, address: { ...address, location: KOTA }, paymentMethod: "cod", draftId: "d1" } as never,
      {} as never,
    );
    expect(state.inserted).not.toBeNull();
  });
});
