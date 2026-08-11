/**
 * A coupon that has stopped applying has to say so.
 *
 * Two ways it did not:
 *
 * 1. `revalidateCoupon` returns the coupon or null, and the checkout page threw
 *    the null away. Remove a cake and a "₹200 off orders over ₹1,500" stops
 *    qualifying: the discount disappeared from the totals while the green chip
 *    beside them carried on reading "SAVE200 (₹200 off)". Nothing said what had
 *    happened or what would bring it back.
 *
 * 2. The quote response has carried `rejectedCoupon` since it was written — its
 *    own comment says "so the customer can be told" — and nothing read it. A
 *    code the SHOP refuses leaves the server's total higher than the browser's,
 *    which tripped the price-change branch, so an expired or exhausted coupon
 *    was reported as "Prices have changed" with a bigger number and no reason.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { applyCouponCode, revalidateCoupon } from "@/features/orders/lib/coupons";

const page = readFileSync(
  join(process.cwd(), "apps/website/checkout/pages/checkout-page.tsx"),
  "utf8",
);
const input = readFileSync(
  join(process.cwd(), "apps/website/checkout/components/coupon-input.tsx"),
  "utf8",
);

describe("a coupon that no longer qualifies", () => {
  it("still reports a reason, not just a refusal", () => {
    // The raw rule, so the test does not depend on which codes this shop has.
    const refusal = applyCouponCode("DEFINITELY-NOT-A-CODE", 5000);

    expect(refusal.ok).toBe(false);
    expect(
      refusal.ok ? "" : refusal.message,
      "there is no reason to show the customer",
    ).toBeTruthy();
  });

  it("is checked with its reason kept, not through the reason-discarding helper", () => {
    // `revalidateCoupon` is fine for callers that only need the coupon; the
    // checkout page needs to explain itself.
    expect(page).toContain("couponLapsedReason");
    expect(page).not.toContain("revalidateCoupon(coupon");
  });

  it("hands that reason to the chip instead of leaving it green", () => {
    expect(page).toContain("lapsedReason={couponLapsedReason}");
    expect(input).toContain("applied && lapsedReason");
    expect(input).toContain("no longer applies");
    // Amber, so it does not read as a discount that is still being given.
    expect(input).toContain("bg-amber-50");
  });

  it("keeps returning the coupon while it does qualify", () => {
    // The other direction: this must not start warning about a live coupon.
    const earned = applyCouponCode("SAVE10", 100000);
    if (earned.ok) {
      expect(revalidateCoupon(earned.coupon, 100000)?.code).toBe(earned.coupon.code);
    }
  });
});

describe("a coupon the shop itself refuses", () => {
  it("is reported as a refused coupon, not as a price change", () => {
    expect(page).toContain("quote.rejectedCoupon");
    expect(page).toContain("could not be applied");
  });

  it("is checked BEFORE the price-change branch it would otherwise trigger", () => {
    const rejected = page.indexOf("if (quote.rejectedCoupon)");
    const priceChange = page.indexOf('toast.error("Prices have changed"');

    expect(rejected).toBeGreaterThan(-1);
    expect(priceChange).toBeGreaterThan(-1);
    expect(
      rejected,
      "the price-change toast fires first, so the reason is never shown",
    ).toBeLessThan(priceChange);
  });

  it("drops the refused code rather than re-sending it on the next attempt", () => {
    const branch = page.slice(page.indexOf("if (quote.rejectedCoupon)"));
    const body = branch.slice(0, branch.indexOf("return;"));

    expect(body).toContain("setCoupon(undefined)");
    // And out of the draft too, or a reload brings it back.
    expect(body).toContain("persistDraft({ coupon: undefined })");
  });
});
