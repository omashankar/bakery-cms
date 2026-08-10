// A non-UTC zone, set before anything here touches Date — in UTC the expiry
// assertions pass against the broken implementation too.
process.env.TZ = "Asia/Kolkata";

import { describe, expect, it } from "vitest";

import { hasExpired, toExpiryInputValue, toExpiryInstant } from "@/lib/expiry-date";
import { evaluateCoupon, type CouponRule } from "@/features/orders/lib/coupons";
import { couponsReplaceSchema } from "@/features/commerce/server/commerce.validators";

/**
 * A coupon is money. A wrong answer here is the shop losing cash on a real
 * order, or a customer being charged more than they were promised.
 */

function rule(over: Partial<CouponRule> = {}): CouponRule {
  return { code: "SAVE10", label: "10% OFF", percentOff: 10, ...over };
}

describe("when a coupon expires", () => {
  it("runs in a zone where the bug is observable", () => {
    expect(new Date("2026-12-31T00:00:00.000Z").getHours()).toBe(5);
  });

  it("lasts until the END of the day the admin chose", () => {
    // `new Date("2026-12-31")` is UTC midnight, so a coupon advertised as "valid
    // through 31 December" died at 05:30 IST that morning and every customer
    // from breakfast onwards paid full price.
    const stored = toExpiryInstant("2026-12-31");

    const breakfast = new Date(2026, 11, 31, 9, 0).getTime();
    const lateNight = new Date(2026, 11, 31, 23, 30).getTime();
    const nextMorning = new Date(2027, 0, 1, 9, 0).getTime();

    expect(hasExpired(stored, breakfast)).toBe(false);
    expect(hasExpired(stored, lateNight)).toBe(false);
    expect(hasExpired(stored, nextMorning)).toBe(true);
  });

  it("round-trips back into the date field as the day the admin picked", () => {
    expect(toExpiryInputValue(toExpiryInstant("2026-12-31"))).toBe("2026-12-31");
    expect(toExpiryInputValue(toExpiryInstant("2026-01-01"))).toBe("2026-01-01");
  });

  it("treats an unreadable expiry as EXPIRED, not as never-expiring", () => {
    // `new Date("31/12/2026").getTime()` is NaN and `NaN < now` is false, so a
    // coupon stored that way used to be permanently live. Refusing a discount is
    // recoverable; giving one away for ever is not.
    expect(hasExpired("31/12/2026")).toBe(true);
    expect(hasExpired("soon")).toBe(true);
    expect(hasExpired("")).toBe(false);
    expect(hasExpired(undefined)).toBe(false);
  });

  it("refuses the code at checkout once it has expired", () => {
    const expired = rule({ expiresAt: toExpiryInstant("2020-01-01") });

    const result = evaluateCoupon([expired], "SAVE10", 1000);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/expired/i);
  });

  it("refuses a code whose expiry cannot be read", () => {
    const broken = rule({ expiresAt: "31/12/2026" });

    expect(evaluateCoupon([broken], "SAVE10", 1000).ok).toBe(false);
  });

  it("keeps accepting a code that has not expired", () => {
    const live = rule({ expiresAt: toExpiryInstant("2099-01-01") });

    expect(evaluateCoupon([live], "SAVE10", 1000).ok).toBe(true);
  });

  it("will not store an expiry that is not a date", () => {
    const base = {
      id: "c1",
      code: "SAVE10",
      isActive: true,
      usageCount: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    expect(couponsReplaceSchema.safeParse([{ ...base, expiresAt: "31/12/2026" }]).success).toBe(
      false,
    );
    expect(couponsReplaceSchema.safeParse([{ ...base, expiresAt: "soon" }]).success).toBe(false);
    expect(
      couponsReplaceSchema.safeParse([{ ...base, expiresAt: "2026-12-31T18:29:59.999Z" }])
        .success,
    ).toBe(true);
    expect(couponsReplaceSchema.safeParse([base]).success).toBe(true);
  });
});

/**
 * A coupon save sends the WHOLE list. Without `knownIds` it asserts "these are
 * all the coupons there are", so a tab opened before another admin created a
 * code silently deleted it — the delivery zones beside it were fixed for exactly
 * this and the coupons were not.
 */
describe("what a coupon save claims", () => {
  const coupon = {
    id: "c1",
    code: "SAVE10",
    isActive: true,
    usageCount: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts a bare array, and then claims to know nothing", () => {
    const parsed = couponsReplaceSchema.parse([coupon]);

    expect(parsed.coupons).toHaveLength(1);
    expect(parsed.knownIds).toBeNull();
  });

  it("accepts a save that says what it knew", () => {
    const parsed = couponsReplaceSchema.parse({
      coupons: [coupon],
      knownIds: ["c1", "c2"],
    });

    expect(parsed.knownIds).toEqual(["c1", "c2"]);
  });

  it("still refuses a malformed coupon in either shape", () => {
    expect(couponsReplaceSchema.safeParse([{ ...coupon, code: "" }]).success).toBe(false);
    expect(
      couponsReplaceSchema.safeParse({ coupons: [{ ...coupon, percentOff: 150 }], knownIds: [] })
        .success,
    ).toBe(false);
  });
});

/**
 * The two evaluations — the browser's and the server's — have to agree, because
 * the customer is shown one and charged by the other.
 */
describe("the discount itself", () => {
  it("accepts a subtotal exactly on the minimum", () => {
    const result = evaluateCoupon([rule({ minSubtotal: 1000 })], "SAVE10", 1000);

    expect(result.ok).toBe(true);
  });

  it("refuses a subtotal a rupee under it", () => {
    expect(evaluateCoupon([rule({ minSubtotal: 1000 })], "SAVE10", 999).ok).toBe(false);
  });

  it("never gives back more than the basket", () => {
    const result = evaluateCoupon(
      [rule({ percentOff: undefined, flatOff: 5000 })],
      "SAVE10",
      1200,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.coupon.discountAmount).toBe(1200);
  });

  it("ignores case and surrounding space in the typed code", () => {
    expect(evaluateCoupon([rule()], "  save10 ", 1000).ok).toBe(true);
  });

  it("refuses a coupon the admin switched off", () => {
    expect(evaluateCoupon([rule({ isActive: false })], "SAVE10", 1000).ok).toBe(false);
  });
});
