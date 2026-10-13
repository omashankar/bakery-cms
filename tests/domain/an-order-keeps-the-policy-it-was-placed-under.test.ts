import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * AN ORDER KEEPS THE CANCELLATION POLICY IT WAS PLACED UNDER.
 *
 * A cancellation is judged by what the customer agreed to — not by how the
 * shop has reclassified a product or reworded its policy since. So placing an
 * order copies the policy onto it: each line's class read from the SHOP's
 * product, the shop's wording, a version, and the moment the customer ticked
 * the checkout agreement. Only that moment comes from the browser.
 */

const CATALOGUE: Record<string, Record<string, unknown>> = {
  "black-forest": {
    name: "Black Forest",
    price: 500,
    image: "/bf.jpg",
    category: "Cakes",
    allowsPhotoUpload: false,
    weights: [],
    cancellationClass: "made_to_order",
  },
  candle: {
    name: "Candle",
    price: 50,
    image: "/c.jpg",
    category: "Extras",
    allowsPhotoUpload: false,
    weights: [],
    // No class set: an ordinary, ready-made item.
  },
};

const state = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  commerce: {} as Record<string, unknown>,
}));

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async (slug: string) => (slug in CATALOGUE ? { slug, ...CATALOGUE[slug] } : null),
  listBySlugs: async () => [],
  patch: async () => null,
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ commerce: state.commerce, general: { currency: "INR" } }),
}));
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
  findDraft: async () => null,
  consumeDraft: async () => true,
  claimDraft: async () => null,
}));

import { placeOrder } from "@/features/orders/server/order.service";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";

const address = {
  fullName: "Asha Menon",
  email: "asha@example.com",
  phone: "+91 90000 00000",
  addressLine1: "1 Test Road",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
};

function setCommerce(overrides: Record<string, unknown> = {}) {
  state.commerce = {
    ...defaultCommerceSettings,
    useZoneBasedDelivery: false,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    platformChargeEnabled: false,
    giftWrapEnabled: false,
    minOrderValue: 0,
    ...overrides,
  };
  state.inserted = null;
}

function order(personalisation?: Record<string, unknown>) {
  return placeOrder(
    {
      items: [
        { productSlug: "black-forest", name: "Black Forest", price: 500, quantity: 1 },
        { productSlug: "candle", name: "Candle", price: 50, quantity: 2 },
      ],
      totals: { subtotal: 600, total: 600, tax: 0, itemCount: 3 },
      address,
      paymentMethod: "cod",
      ...(personalisation ? { personalisation } : {}),
    } as never,
    {} as never,
  );
}

type Policy = {
  version: string;
  text: string;
  policyClass: string;
  itemClasses: { productSlug: string; policyClass: string }[];
  acceptedAt?: string;
};

describe("placing an order copies its cancellation policy", () => {
  // These place a cash order for the cake; cash for it is tested on its own
  // below, so here the shop has ticked it.
  beforeEach(() => {
    CATALOGUE["black-forest"].codAllowed = true;
  });
  afterEach(() => {
    delete CATALOGUE["black-forest"].codAllowed;
  });

  it("records each line's class from the shop's product, and judges by the strictest", async () => {
    setCommerce({ cancellationPolicyText: "Cakes are baked to order." });
    await order({ termsAcceptedAt: "2026-10-13T09:00:00.000Z" });

    const policy = state.inserted?.cancellationPolicy as Policy;
    expect(policy.itemClasses).toEqual([
      { productSlug: "black-forest", policyClass: "made_to_order" },
      { productSlug: "candle", policyClass: "standard" },
    ]);
    expect(policy.policyClass).toBe("made_to_order");
    expect(policy.text).toBe("Cakes are baked to order.");
    expect(policy.version).toMatch(/^p/);
  });

  it("records WHEN the customer agreed, and nothing when they did not", async () => {
    setCommerce();
    await order({ termsAcceptedAt: "2026-10-13T09:00:00.000Z" });
    expect((state.inserted?.cancellationPolicy as Policy).acceptedAt).toBe("2026-10-13T09:00:00.000Z");

    setCommerce();
    await order();
    expect(state.inserted?.cancellationPolicy as Policy).not.toHaveProperty("acceptedAt");
  });

  it("falls back to the shop's default wording when none is set", async () => {
    setCommerce({ cancellationPolicyText: "   " });
    await order();
    expect((state.inserted?.cancellationPolicy as Policy).text).toBe(
      defaultCommerceSettings.cancellationPolicyText,
    );
  });
});

/**
 * CASH ON DELIVERY IS REFUSED FOR A PRODUCT THAT TAKES NONE — on the server,
 * whatever the checkout page offered. One such line takes cash off the order.
 */
describe("cash on delivery at placement", () => {
  function cod(lines: Array<{ productSlug: string; name: string; price: number; quantity: number }>) {
    return placeOrder(
      { items: lines, totals: { subtotal: 0, total: 0, tax: 0, itemCount: 1 }, address, paymentMethod: "cod" } as never,
      {} as never,
    );
  }
  const cake = { productSlug: "black-forest", name: "Black Forest", price: 500, quantity: 1 };
  const candle = { productSlug: "candle", name: "Candle", price: 50, quantity: 1 };

  it("refuses a made-to-order cake, naming it, and stores nothing", async () => {
    setCommerce();
    await expect(cod([candle, cake])).rejects.toThrow(/not available for Black Forest/);
    expect(state.inserted).toBeNull();
  });

  it("takes cash for ready-made items", async () => {
    setCommerce();
    await cod([candle]);
    expect(state.inserted).not.toBeNull();
  });

  it("takes cash for a cake the shop has ticked for it", async () => {
    setCommerce();
    CATALOGUE["black-forest"].codAllowed = true;
    try {
      await cod([cake]);
      expect(state.inserted).not.toBeNull();
    } finally {
      delete CATALOGUE["black-forest"].codAllowed;
    }
  });
});
