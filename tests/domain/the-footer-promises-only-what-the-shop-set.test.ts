import { describe, expect, it } from "vitest";

import { footerPromisesFrom } from "@/apps/website/lib/footer-promises";

/**
 * The band across the top of the footer, on every page. The owner's reference
 * fills it with "700+ cities" and "20,000,000 customers" — numbers this
 * software cannot know — so ours says only what the shop's own settings make
 * true, and nothing at all when they say nothing.
 */
const titles = (commerce: Record<string, unknown>) =>
  footerPromisesFrom(commerce, "INR").map((promise) => `${promise.title} | ${promise.subtitle}`);

describe("the footer's promises", () => {
  it("states this shop's delivery, threshold and online payment", () => {
    expect(
      titles({
        deliveryLeadDays: 0,
        sameDayCutoff: "14:00",
        freeDeliveryThreshold: 999,
        paymentMethods: { razorpay: true, cod: true },
      }),
    ).toEqual([
      "Same-day delivery | Order by 14:00",
      "Free delivery | On orders over ₹999",
      "Secure payments | UPI, cards and netbanking",
    ]);
  });

  it("follows a longer lead time", () => {
    expect(titles({ deliveryLeadDays: 1 })[0]).toBe("Next-day delivery | Order today, get it tomorrow");
    expect(titles({ deliveryLeadDays: 3 })[0]).toBe("Delivery in 3 days | Order 3 days ahead");
  });

  it("claims nothing the settings do not say", () => {
    expect(titles({})).toEqual([]);
    // `Number(null)` is 0 — read loosely, that promised same-day delivery.
    expect(titles({ deliveryLeadDays: null, freeDeliveryThreshold: null })).toEqual([]);
    expect(titles({ freeDeliveryThreshold: 0 })).toEqual([]);
  });

  it("does not offer online payment the shop switched off", () => {
    expect(titles({ paymentMethods: { razorpay: false, cod: true } })).toEqual([]);
    expect(titles({ paymentMethods: { cod: true } })).toEqual([]);
  });
});
