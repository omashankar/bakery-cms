import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/utils/format";
import { earliestDeliveryDateString, isBeforeLeadTime } from "@/features/orders/lib/delivery-date";
import { getMinDeliveryDate } from "@/apps/website/lib/product-details";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";

/**
 * A settings value that reaches `Intl` unchecked is not a formatting glitch.
 *
 * `Intl.NumberFormat` throws `RangeError: Invalid currency code`, and the
 * settings model stores `general.currency` as a bare `String` — the Zod enum
 * only constrains future writes, so a document written before it existed can
 * still hold "Rs". `getActiveLocale()` already ran the AMBIENT value through a
 * filter for exactly this reason; the explicit argument, which is the one the
 * server always passes, skipped it with a bare `??`.
 *
 * Where it fired matters: while building the WhatsApp notification arguments in
 * `placeOrder`, AFTER the order is committed and the card is charged. The
 * customer got a 500 on an order that had gone through, no confirmation of any
 * kind was sent, and the bakery was never told. It also turned a legitimate 409
 * "below the minimum order" refusal into a masked 500, and blanked the
 * Appearance admin screen mid-render.
 */
describe("formatting money can never take a page down", () => {
  const bad = ["Rs", "rs.", "₹", "INVALID", "", "  ", "toString", "constructor", "__proto__"];

  for (const currency of bad) {
    it(`falls back rather than throwing on ${JSON.stringify(currency)}`, () => {
      expect(() => formatCurrency(1299, currency)).not.toThrow();
      expect(formatCurrency(1299, currency)).toContain("1,299");
    });
  }

  it("still honours a currency it recognises", () => {
    expect(formatCurrency(1299, "USD")).toContain("$");
    expect(formatCurrency(1299, "EUR")).toContain("€");
    expect(formatCurrency(1299, "INR")).toContain("₹");
  });

  it("lower-case is not silently accepted as its upper-case twin", () => {
    // "usd" is not a code `Intl` takes; falling back is right, guessing is not.
    expect(() => formatCurrency(10, "usd")).not.toThrow();
  });
});

/**
 * The shop-wide lead time was collected, displayed, and enforced nowhere.
 *
 * The only server-side date guard read `deliveryMinDays`, which a quote carries
 * only when zone pricing is ON and a zone matched — and zone pricing defaults to
 * off. So on an ordinary shop the value was `Number(undefined)` → NaN, and
 * `isBeforeLeadTime` treats a non-finite lead as unconstrained: "we need 3 days
 * to bake this" was enforced by an `<input min=…>` and nothing else.
 */
describe("the lead time the two checks have to agree on", () => {
  const day = (offset: number) => earliestDeliveryDateString(offset);

  it("is unconstrained when neither source gives a number — which is why NaN had to stop meaning that", () => {
    expect(isBeforeLeadTime(day(0), Number(undefined))).toBe(false);
    expect(isBeforeLeadTime(day(0), 0)).toBe(false);
  });

  it("refuses today when the shop asks for three days", () => {
    // One day of slack is deliberate — the customer's calendar and the
    // server's can differ, and this runs after the card is captured. It is
    // still a real floor: same-day is refused.
    expect(isBeforeLeadTime(day(0), 3)).toBe(true);
    expect(isBeforeLeadTime(day(1), 3)).toBe(true);
    expect(isBeforeLeadTime(day(2), 3)).toBe(false);
  });

  it("is taken from BOTH sources at the quote and at placement", () => {
    // The rule itself lives on the server and needs a database to exercise, so
    // this pins the shape at both sites; the behaviour is verified live against
    // the running app (a same-day order with a three-day shop floor and zone
    // pricing OFF is refused 409 "We need 3 days to prepare an order").
    for (const file of [
      "features/orders/server/order.service.ts",
      "features/checkout/server/checkout.controller.ts",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const leadLine = source.slice(source.indexOf("const leadDays ="));
      const decl = leadLine.slice(0, leadLine.indexOf(";") + 1);

      expect(decl, file + " ignores the zone lead time").toContain("deliveryMinDays");
      expect(decl, file + " ignores the shop-wide lead time").toContain("deliveryLeadDays");
      // Math.max, not a fallback: a permissive zone must not lower the shop's
      // own floor, and a missing zone value must not mean "no check".
      expect(decl, file + " does not take the stricter of the two").toContain("Math.max");
    }
  });

  it("a permissive zone cannot lower the shop's own floor", () => {
    // 3-day shop floor with the deliberate one-day slack refuses tomorrow;
    // a 1-day floor allows it. That difference is what Math.max preserves.
    expect(isBeforeLeadTime(day(1), 3)).toBe(true);
    expect(isBeforeLeadTime(day(1), 1)).toBe(false);
  });
});

/**
 * `new Date()` + `setDate()` + `toISOString()` builds a LOCAL instant and reads
 * it back in UTC. East of UTC those disagree: at 01:00 IST with a one-day lead
 * time, local tomorrow is still today in UTC — so the picker offered TODAY and
 * pre-selected it, below the shop's own floor. `delivery-date.ts` exists for
 * this; checkout used it for the zone floor while the shop-wide floor beside it
 * came from the un-fixed twin, and the product page had no second opinion at
 * all.
 */
describe("the earliest date the picker offers", () => {
  it("matches the calendar helper written to replace the buggy pattern", () => {
    // Whatever the machine's zone, these two must agree — the old
    // implementation disagreed with it for a third of the day in IST.
    expect(getMinDeliveryDate()).toBe(
      // The browser-less branch uses the shipped default.
      earliestDeliveryDateString(defaultCommerceSettings.deliveryLeadDays),
    );
  });

  it("never offers a date the lead-time check would refuse", () => {
    const leadDays = defaultCommerceSettings.deliveryLeadDays;

    expect(isBeforeLeadTime(getMinDeliveryDate(), leadDays)).toBe(false);
  });

  it("does not build the answer with the pattern that caused this", () => {
    // The equality above only fails on a machine whose zone actually exposes
    // the bug — in UTC the two agree by coincidence. This holds anywhere.
    const source = readFileSync(join(process.cwd(), "apps/website/lib/product-details.ts"), "utf8");
    const fn = source.slice(source.indexOf("export function getMinDeliveryDate"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    expect(body).toContain("earliestDeliveryDateString(");
    expect(body).not.toContain("toISOString");
    expect(body).not.toContain("setDate(");
  });

  it("stays in the calendar across a month end, in any zone", () => {
    // 31 Jan + 1 day is 1 Feb, not "the 32nd" and not 31 Jan again.
    expect(earliestDeliveryDateString(1, new Date(2026, 0, 31, 1, 0, 0))).toBe("2026-02-01");
    expect(earliestDeliveryDateString(1, new Date(2026, 0, 31, 23, 30, 0))).toBe("2026-02-01");
    // A leap day is a real day.
    expect(earliestDeliveryDateString(1, new Date(2028, 1, 28, 1, 0, 0))).toBe("2028-02-29");
  });
});

/**
 * `commerce.paymentMethods` was read in four places and every one was in the
 * browser. Not merely a devtools hole: the checkout page starts from
 * `defaultCommerceSettings`, where every method is on, and pins the selection to
 * the first of them — Cash on Delivery. Hydration then removes the COD radio
 * from the screen and nothing moved the SELECTION, so an ordinary first-time
 * customer submitted `cod` to a shop that had switched it off. A COD order
 * lands as `confirmed`: a cake the bakery is expected to bake and hand over for
 * cash it decided it would no longer take.
 */
describe("a payment method the shop switched off", () => {
  it("is refused by the server, not only hidden by the checkout page", () => {
    const source = readFileSync(
      join(process.cwd(), "features/orders/server/order.service.ts"),
      "utf8",
    );

    expect(source).toContain("commerce.paymentMethods?.[input.paymentMethod] === false");
    // Only for a cart that was never quoted — refusing after the gateway has
    // captured would strand a customer because an admin flipped a switch in
    // between, which is the same rule the minimum-order check follows.
    expect(source).toMatch(/if \(!draft && commerce\.paymentMethods/);
  });

  it("stops being the selected one as soon as the real settings arrive", () => {
    const page = readFileSync(
      join(process.cwd(), "apps/website/checkout/pages/checkout-page.tsx"),
      "utf8",
    );

    // The old effect handled exactly one case — the Razorpay gateway having no
    // keys — and left the general one, so the selection could sit on a method
    // that was no longer on the list.
    expect(page).toContain(
      "if (availablePaymentOptions.some((option) => option.value === paymentMethod)) return;",
    );
    expect(page).toContain("setPaymentMethod(availablePaymentOptions[0].value);");
    // And it must not fire during the pre-hydration instant, when the list is
    // legitimately empty.
    expect(page).toContain("if (availablePaymentOptions.length === 0) return;");
  });
});

/**
 * `finalizeOrder("paid", …)` is only reached once the gateway has CAPTURED. The
 * maintenance branch was added after the unconfirmed-order branch and skipped
 * what that one exists for: a customer whose card had just been charged got a
 * toast, and the payment reference — in scope — was thrown away. The order is
 * not lost (the webhook places it under a number it mints itself), which is
 * exactly why the customer needs the reference in front of them.
 */
describe("a customer who paid just as the shop closed", () => {
  const page = readFileSync(
    join(process.cwd(), "apps/website/checkout/pages/checkout-page.tsx"),
    "utf8",
  );

  it("is shown the payment reference rather than a toast", () => {
    const branch = page.slice(page.indexOf("if (closed) {"));
    const body = branch.slice(0, branch.indexOf("if (!persisted)"));

    expect(body).toContain('if (paymentStatus === "paid" || paymentReference)');
    expect(body).toContain("setUnconfirmed({ order, paymentStatus, paymentReference, closed })");
  });

  it("is not offered a retry that cannot succeed while the shop is shut", () => {
    expect(page).toContain("...(unconfirmed.closed");
    expect(page).toContain("Contact support");
  });
});
