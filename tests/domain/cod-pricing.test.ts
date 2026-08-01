import { describe, expect, it, vi } from "vitest";

/**
 * Placing a COD order without quoting first.
 *
 * A draft — the cart the shop priced — is only REQUIRED for an online payment,
 * because a headless COD caller may legitimately not have one. That `??` was
 * the hole: `draft?.totals ?? input.totals` fell through to the request body,
 * so an anonymous `POST /api/orders` with `paymentMethod: "cod"` and no
 * `draftId` had its own subtotal, its own tax and its own total stored
 * verbatim. The earlier pass closed this for anything that pays a gateway and
 * left the cash door open — and COD is the one where a wrong total is what the
 * delivery rider collects at the customer's doorstep.
 *
 * The real `priceCart` runs here. Only Mongo and the gateway are stubbed, so
 * the arithmetic under test is the arithmetic checkout uses.
 */

/** Shaped like a real catalogue document — `priceCart` reads the options off it. */
const CATALOGUE: Record<string, Record<string, unknown>> = {
  "black-forest": {
    name: "Black Forest",
    price: 5000,
    image: "/bf.jpg",
    category: "Cakes",
    isEggless: false,
    allowsPhotoUpload: false,
    weights: [],
  },
};

const state = vi.hoisted(() => ({
  inserted: null as Record<string, unknown> | null,
  commerce: {} as Record<string, unknown>,
  coupons: [] as Record<string, unknown>[],
  redemptions: [] as string[],
  audit: [] as Record<string, unknown>[],
}));

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async (slug: string) =>
    slug in CATALOGUE ? { slug, ...CATALOGUE[slug] } : null,
  listBySlugs: async () => [],
  patch: async () => null,
}));

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ commerce: state.commerce, general: { currency: "INR" } }),
}));

vi.mock("@/features/commerce/server/commerce.service", () => ({
  getCoupons: async () => state.coupons,
  getZones: async () => [],
}));

vi.mock("@/features/commerce/server/commerce.repository", () => ({
  incrementCouponUsage: async (code: string) => {
    state.redemptions.push(code);
  },
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
  writeAuditLog: async (entry: Record<string, unknown>) => {
    state.audit.push(entry);
  },
  requestContext: () => ({}),
}));

vi.mock("@/features/payments/server/unclaimed-payment.repository", () => ({
  resolveUnclaimedPayment: async () => undefined,
}));

vi.mock("@/features/checkout/server/draft.repository", () => ({
  findDraft: async () => null,
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
    taxEnabled: true,
    taxRate: 0.05,
    taxIncludeDelivery: false,
    platformChargeEnabled: false,
    giftWrapEnabled: false,
    minOrderValue: 0,
    ...overrides,
  };
  state.inserted = null;
  state.coupons = [];
  state.redemptions = [];
  state.audit = [];
}

/** A COD order that names a real product but costs it at a rupee. */
function codOrder(overrides: Record<string, unknown> = {}) {
  return placeOrder(
    {
      items: [
        { productSlug: "black-forest", name: "Black Forest", price: 1, quantity: 1 },
      ],
      totals: { subtotal: 1, total: 1, tax: 0, itemCount: 1 },
      address,
      paymentMethod: "cod",
      ...overrides,
    } as never,
    {} as never,
  );
}

describe("a COD order placed without a draft", () => {
  it("stores the SHOP's price, not the caller's", async () => {
    setCommerce();
    await codOrder();

    const totals = state.inserted?.totals as Record<string, number>;
    const items = state.inserted?.items as Record<string, number>[];

    // The catalogue says 5000. The request said 1.
    expect(items[0].price).toBe(5000);
    expect(totals.subtotal).toBe(5000);
    expect(totals.total).toBe(5250);
  });

  it("computes the tax itself rather than accepting a zero", async () => {
    setCommerce();
    await codOrder();

    const totals = state.inserted?.totals as Record<string, number>;
    // The request claimed `tax: 0` against a taxable shop. 5% of 5000.
    expect(totals.tax).toBe(250);
    expect(totals.taxRate).toBe(0.05);
  });

  it("records the SHOP's total in the audit log, not the caller's claim", async () => {
    setCommerce();
    await codOrder();

    const placed = state.audit.find((e) => e.action === "order.place");
    // The audit log is the record kept specifically to be trusted later, and it
    // stored the caller's own claimed total — the one number it exists to
    // detect lies about.
    expect((placed?.metadata as Record<string, number>).total).toBe(5250);
  });

  it("refuses a slug the catalogue does not have, rather than pricing it at zero", async () => {
    setCommerce();
    await expect(
      codOrder({
        items: [{ productSlug: "deleted-cake", name: "Ghost", price: 1, quantity: 1 }],
      }),
    ).rejects.toThrow(/no longer available/i);
    expect(state.inserted).toBeNull();
  });

  it("counts the redemption of a coupon it actually applied", async () => {
    setCommerce();
    state.coupons = [
      { id: "c1", code: "SAVE500", label: "500 off", flatOff: 500, isActive: true },
    ];

    await codOrder({ coupon: { code: "SAVE500" } });

    const totals = state.inserted?.totals as Record<string, number>;
    expect(totals.discount).toBe(500);
    // The redemption counter only moved for orders that came through a DRAFT,
    // so a usage-limited code could be spent without limit through the one path
    // that skips the quote.
    expect(state.redemptions).toEqual(["SAVE500"]);
  });

  it("ignores a coupon object the caller invented", async () => {
    setCommerce();
    // The coupon used to arrive as a free-form object, discount included, and
    // was stored whole — then counted in the admin's coupon performance report.
    await codOrder({ coupon: { code: "FREE", discountAmount: 4999 } });

    const totals = state.inserted?.totals as Record<string, number>;
    expect(totals.discount).toBe(0);
    expect(totals.total).toBe(5250);
    expect(state.inserted?.coupon ?? null).toBeNull();
  });

  it("charges gift wrap only when the request actually asked for it", async () => {
    setCommerce({ giftWrapEnabled: true, giftWrapFee: 100 });

    await codOrder();
    expect((state.inserted?.totals as Record<string, number>).giftWrapFee).toBe(0);

    await codOrder({
      totals: { subtotal: 1, total: 1, itemCount: 1, giftWrapFee: 100 },
    });
    const wrapped = state.inserted?.totals as Record<string, number>;
    expect(wrapped.giftWrapFee).toBe(100);
    // Taxed with the goods, not added after tax.
    expect(wrapped.taxableAmount).toBe(5100);
    expect(wrapped.tax).toBe(255);
  });
});

describe("the shop's minimum order value, at placement", () => {
  it("refuses a cart below it", async () => {
    setCommerce({ minOrderValue: 6000 });
    await expect(codOrder()).rejects.toThrow(/minimum order/i);
    expect(state.inserted).toBeNull();
  });

  it("is measured against the SHOP's subtotal, not the caller's", async () => {
    // The request claims a subtotal of 1. Were the minimum checked against
    // that, a 5000-rupee cart would be refused by a 4000-rupee minimum.
    setCommerce({ minOrderValue: 4000 });
    await codOrder();
    expect(state.inserted).not.toBeNull();
  });

  it("lets a cart through when the shop has no minimum", async () => {
    setCommerce({ minOrderValue: 0 });
    await codOrder();
    expect(state.inserted).not.toBeNull();
  });
});
