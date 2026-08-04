/**
 * The money path, after the server took the pricing decision back.
 *
 * Everything about the amount used to be chosen by the caller.
 * `cartItemSchema.price` and `totalsSchema.total` were stored verbatim, and
 * `POST /api/razorpay/order` took `amount` from the request body — so a
 * 5000-rupee cake could be ordered, and genuinely paid for, at 1 rupee.
 * Reproduced against a running server before the fix; these pin the pieces that
 * are pure enough to hold in a test.
 */
import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { evaluateCoupon, resolveCouponDiscount } from "@/features/orders/lib/coupons";
import { verifyWebhookSignature } from "@/features/payments/lib/webhook-signature";
import { quoteSchema } from "@/features/checkout/server/checkout.validators";
import { placeOrderSchema } from "@/features/orders/server/order.validators";

describe("what a caller may say about a cart", () => {
  const cart = {
    items: [{ productSlug: "chocolate-truffle-delight", quantity: 1 }],
  };

  it("accepts the choice but never the price", () => {
    const parsed = quoteSchema.parse({
      ...cart,
      items: [{ ...cart.items[0], price: 1, name: "Free cake" } as never],
    }) as { items: Record<string, unknown>[] };

    // `price` is the whole vulnerability. It must not survive into anything the
    // server then treats as a number it owes.
    expect(parsed.items[0].price).toBeUndefined();
    expect(parsed.items[0].productSlug).toBe("chocolate-truffle-delight");
    expect(parsed.items[0].quantity).toBe(1);
  });

  it("takes a coupon CODE, never a coupon object with a discount in it", () => {
    const parsed = quoteSchema.parse({ ...cart, couponCode: "welcome10" });
    expect(parsed.couponCode).toBe("welcome10");

    // The order used to carry `coupon: z.record(z.string(), z.unknown())` — an
    // object the caller invented, discount included, which then appeared in the
    // admin's coupon performance report as if it were real.
    const withObject = quoteSchema.safeParse({
      ...cart,
      couponCode: { code: "FREE", discountAmount: 99999 } as never,
    });
    expect(withObject.success).toBe(false);
  });

  it("refuses an empty cart and an absurd quantity", () => {
    expect(quoteSchema.safeParse({ items: [] }).success).toBe(false);
    expect(
      quoteSchema.safeParse({ items: [{ productSlug: "x", quantity: 0 }] }).success,
    ).toBe(false);
    expect(
      quoteSchema.safeParse({ items: [{ productSlug: "x", quantity: 1000 }] }).success,
    ).toBe(false);
  });

  it("carries the order intent, so a webhook can finish without the browser", () => {
    // A payment that completes after the tab closes used to leave money in the
    // shop's gateway account with no order behind it.
    const parsed = quoteSchema.parse({
      ...cart,
      address: {
        fullName: "Asha",
        email: "asha@example.com",
        phone: "9000000000",
        addressLine1: "12 Bakery Lane",
        city: "Mumbai",
        state: "MH",
        pincode: "400001",
      },
      deliverySlot: { date: "2026-08-01", timeSlot: "2:00 PM – 4:00 PM" },
      orderNotes: "Leave at the door",
    });

    expect(parsed.address?.email).toBe("asha@example.com");
    expect(parsed.deliverySlot?.timeSlot).toBe("2:00 PM – 4:00 PM");
  });
});

describe("placing an order against a priced cart", () => {
  const base = {
    items: [{ productSlug: "cake", name: "Cake", price: 1, quantity: 1 }],
    totals: { subtotal: 1, total: 1, itemCount: 1 },
    address: {
      fullName: "Mallory",
      email: "m@example.com",
      phone: "9000000000",
      addressLine1: "1 St",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
    },
    paymentMethod: "razorpay" as const,
  };

  it("accepts a draftId — the cart the SHOP priced", () => {
    const parsed = placeOrderSchema.parse({ ...base, draftId: "draft_abc" });
    expect(parsed.draftId).toBe("draft_abc");
  });

  it("still strips every piece of lifecycle state a caller tries to choose", () => {
    const parsed = placeOrderSchema.parse({
      ...base,
      paymentStatus: "paid",
      status: "delivered",
      orderNumber: "BK-FORGED",
      placedAt: "2024-01-01T00:00:00.000Z",
    }) as Record<string, unknown>;

    for (const field of ["paymentStatus", "status", "orderNumber", "placedAt"]) {
      expect(parsed[field], `${field} must not survive`).toBeUndefined();
    }
  });
});

describe("resolving a coupon", () => {
  const coupons = [
    { code: "WELCOME10", label: "10% off", percentOff: 10, isActive: true },
    { code: "FLAT100", label: "₹100 off", flatOff: 100, isActive: true, minSubtotal: 500 },
    { code: "OLD", label: "Expired", percentOff: 50, isActive: true, expiresAt: "2020-01-01" },
    { code: "OFF", label: "Disabled", percentOff: 50, isActive: false },
  ];

  it("applies a real one", () => {
    expect(resolveCouponDiscount(coupons, "WELCOME10", 1000)?.discountAmount).toBe(100);
    expect(resolveCouponDiscount(coupons, "welcome10", 1000)?.discountAmount).toBe(100);
    expect(resolveCouponDiscount(coupons, "FLAT100", 1000)?.discountAmount).toBe(100);
  });

  it("refuses one the shop does not honour", () => {
    // The whole point of moving this server-side: validity used to be decided in
    // the browser, against a localStorage list that seeded itself when missing.
    expect(resolveCouponDiscount(coupons, "MADEUP", 1000)).toBeNull();
    expect(resolveCouponDiscount(coupons, "OFF", 1000)).toBeNull();
    expect(resolveCouponDiscount(coupons, "OLD", 1000)).toBeNull();
    expect(resolveCouponDiscount(coupons, "FLAT100", 100)).toBeNull(); // below minSubtotal
    expect(resolveCouponDiscount(coupons, "", 1000)).toBeNull();
  });

  it("never discounts more than the cart is worth", () => {
    // A discount larger than the subtotal would make the total negative, and
    // `totalsSchema` floors `total` but not `subtotal`.
    const applied = resolveCouponDiscount(coupons, "FLAT100", 50);
    expect(applied).toBeNull();

    const half = evaluateCoupon(
      [{ code: "HALF", label: "50%", percentOff: 50, isActive: true }],
      "HALF",
      1000,
    );
    expect(half.ok && half.coupon.discountAmount).toBe(500);
  });

  it("says WHY, so the customer is not left guessing", () => {
    const expired = evaluateCoupon(coupons, "OLD", 1000);
    expect(expired.ok).toBe(false);
    expect(!expired.ok && expired.message).toMatch(/expired/i);

    const tooSmall = evaluateCoupon(coupons, "FLAT100", 100);
    expect(!tooSmall.ok && tooSmall.message).toMatch(/minimum/i);
  });
});

describe("the webhook signature", () => {
  const secret = "whsec_test_12345";
  const body = JSON.stringify({ event: "payment.captured", payload: { x: 1 } });
  const sign = (raw: string, key = secret) =>
    // Same construction Razorpay uses, computed independently of the module.
    crypto.createHmac("sha256", key).update(raw).digest("hex");

  it("accepts a body Razorpay really signed", () => {
    expect(verifyWebhookSignature(body, sign(body), secret)).toBe(true);
  });

  it("refuses everything else", () => {
    // This one boolean is the entire authentication of an endpoint that creates
    // PAID orders.
    expect(verifyWebhookSignature(body, sign(body, "wrong-secret"), secret)).toBe(false);
    expect(verifyWebhookSignature(body, "deadbeef", secret)).toBe(false);
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
    expect(verifyWebhookSignature(body, sign(body), "")).toBe(false);
    // A tampered body with the ORIGINAL signature — the attack the HMAC exists
    // to stop.
    expect(verifyWebhookSignature(`${body} `, sign(body), secret)).toBe(false);
  });

  it("returns false rather than throwing on a length mismatch", () => {
    // `timingSafeEqual` throws when the buffers differ in length, and an
    // unhandled throw here is a 500 — which Razorpay retries forever.
    expect(() => verifyWebhookSignature(body, "ab", secret)).not.toThrow();
    expect(verifyWebhookSignature(body, "ab", secret)).toBe(false);
  });
});

describe("pricing a cart from the shop's own records", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /** Stubs the three server reads `priceCart` makes, so no database is needed. */
  async function loadPricing(product: Record<string, unknown> | null) {
    vi.doMock("@/features/products/server/product.repository", () => ({
      findBySlug: vi.fn(async () => product),
    }));
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: vi.fn(async () => ({
        commerce: {
          deliveryFee: 99,
          freeDeliveryThreshold: 999,
          minOrderValue: 0,
          taxEnabled: false,
          taxRate: 0,
          taxLabel: "",
          taxIncludeDelivery: false,
          platformChargeEnabled: false,
          platformChargeLabel: "",
          platformChargeAmount: 0,
          useZoneBasedDelivery: false,
          zoneFallbackDeliveryFee: 0,
          deliveryLeadDays: 1,
          estimatedDeliveryDays: 1,
          deliveryTimeSlots: [],
          orderNumberPrefix: "BK",
          checkoutTerms: "",
          giftWrapEnabled: true,
          giftWrapFee: 49,
          giftWrapLabel: "Gift wrap",
          paymentMethods: { cod: true, upi: true, card: true, razorpay: true },
        },
      })),
    }));
    vi.doMock("@/features/commerce/server/commerce.service", () => ({
      getCoupons: vi.fn(async () => [
        { code: "WELCOME10", label: "10% off", percentOff: 10, isActive: true },
      ]),
      getZones: vi.fn(async () => []),
    }));

    return import("@/features/checkout/server/pricing.server");
  }

  const cake = {
    slug: "truffle",
    name: "Chocolate Truffle",
    image: "/cake.jpg",
    price: 1299,
    category: "Cakes",
  };

  it("prices from the PRODUCT, ignoring anything the caller might have wanted", async () => {
    const { priceCart } = await loadPricing(cake);

    const quote = await priceCart({ items: [{ productSlug: "truffle", quantity: 2 }] });

    expect(quote.items[0].price).toBe(1299);
    expect(quote.totals.subtotal).toBe(2598);
    // Over the free-delivery threshold, so no fee — the shop's rule, not the
    // browser's copy of it.
    expect(quote.totals.delivery).toBe(0);
    expect(quote.totals.total).toBe(2598);
  });

  it("applies the shop's commerce settings, not a browser's cached copy", async () => {
    const { priceCart } = await loadPricing({ ...cake, price: 200 });

    const quote = await priceCart({ items: [{ productSlug: "truffle", quantity: 1 }] });

    expect(quote.totals.subtotal).toBe(200);
    expect(quote.totals.delivery).toBe(99); // under the threshold
    expect(quote.totals.total).toBe(299);
  });

  it("resolves the coupon itself and reports one it will not honour", async () => {
    const { priceCart } = await loadPricing(cake);

    const good = await priceCart({
      items: [{ productSlug: "truffle", quantity: 1 }],
      couponCode: "WELCOME10",
    });
    expect(good.coupon?.discountAmount).toBe(130);
    expect(good.totals.total).toBe(1299 - 130);

    const bad = await priceCart({
      items: [{ productSlug: "truffle", quantity: 1 }],
      couponCode: "MADEUP",
    });
    expect(bad.coupon).toBeNull();
    expect(bad.rejectedCoupon).toBe("MADEUP");
    expect(bad.totals.total).toBe(1299);
  });

  it("charges the gift wrap fee only when the shop offers it", async () => {
    const { priceCart } = await loadPricing(cake);
    const quote = await priceCart({
      items: [{ productSlug: "truffle", quantity: 1 }],
      giftWrap: true,
    });
    expect(quote.totals.giftWrapFee).toBe(49);
  });

  it("refuses a cart holding a product the shop does not have", async () => {
    // Priced at zero would be a free cake; guessing which of the cart and the
    // catalogue is right is not the server's call.
    const { priceCart, UnknownProductError } = await loadPricing(null);
    await expect(priceCart({ items: [{ productSlug: "gone", quantity: 1 }] })).rejects.toBeInstanceOf(
      UnknownProductError,
    );
  });

  it("floors the quantity at one, so a fractional line cannot shrink the bill", async () => {
    const { priceCart } = await loadPricing(cake);
    const quote = await priceCart({ items: [{ productSlug: "truffle", quantity: 1.9 }] });
    expect(quote.items[0].quantity).toBe(1);
    expect(quote.totals.subtotal).toBe(1299);
  });
});
