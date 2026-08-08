import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/** Source with comments removed — this file describes the very code it forbids. */
function codeOf(relative: string): string {
  return readFileSync(path.join(process.cwd(), relative), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * A customer's checkout used to PUT the shop's entire coupon list.
 *
 * `recordCouponUsage` read the browser's coupon cache, bumped one counter, and
 * sent the WHOLE list to `/api/coupons` — a replace-all. A visitor whose cache
 * was stale or partial replaced the shop's coupons with it, deleting every code
 * added since that cache was filled.
 *
 * It was also a second count. `placeOrder` already increments the redemption
 * server-side, atomically, against the code the SHOP resolved rather than the
 * one the client claimed.
 */
describe("the coupon redemption counter is the server's", () => {
  it("checkout does not count the redemption itself", () => {
    const page = codeOf("apps/website/checkout/pages/checkout-page.tsx");

    expect(page).not.toContain("recordCouponUsage");
    // Nor any other route to the replace-all from this page.
    expect(page).not.toContain("replaceCouponsRequest");
  });

  it("no browser-side incrementCouponUsage exists to be called", () => {
    const repository = codeOf("features/commerce/lib/coupons-repository.ts");
    expect(repository).not.toContain("export async function incrementCouponUsage");
    expect(repository).not.toContain("export function incrementCouponUsage");
  });

  it("the client coupon module exposes no usage recorder", () => {
    const module = codeOf("features/orders/lib/coupons.ts");
    expect(module).not.toContain("recordCouponUsage");
    expect(module).not.toContain("incrementCouponUsage");
  });

  it("placing an order still counts it, on the server", () => {
    const service = codeOf("features/orders/server/order.service.ts");
    expect(service).toContain("recordCouponRedemption(redeemed)");
  });

  it("and the server's counter is an atomic adjustment, not a list write", () => {
    const repository = codeOf("features/commerce/server/commerce.repository.ts");
    const start = repository.indexOf("async function adjustCouponUsage(");
    const fn = repository.slice(start, repository.indexOf("\n}", start));

    expect(fn).toContain("$inc");
    expect(fn).not.toContain("bulkWrite");
    expect(fn).not.toContain("replaceCoupons");
  });

  it("cancelling still hands the redemption back", () => {
    // The counter only ever went up before, so a coupon with a usage limit was
    // consumed by orders that never happened.
    const repository = codeOf("features/commerce/server/commerce.repository.ts");
    expect(repository).toContain("export async function decrementCouponUsage");
  });
});
