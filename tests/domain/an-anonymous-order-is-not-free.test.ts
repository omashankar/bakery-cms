/**
 * `POST /api/orders` is anonymous by design, and until now it was unlimited.
 *
 * It is not a form submission. Placing an order runs the real placement, which
 * atomically decrements `stockQuantity` inside the same transaction — so a
 * script submitting `paymentMethod: "cod"` in a loop drives the whole catalogue
 * to out-of-stock in seconds, and every genuine customer is then refused at
 * checkout. Nothing about that costs the caller anything: cash on delivery is
 * paid on delivery, and a delivery that never happens is never paid for.
 *
 * A prepaid order is self-limiting — the caller has to actually pay for each
 * one — which is why the two are not held to the same number.
 *
 * The IP half of the guard is deliberately asleep: `clientIpFrom` returns "" in
 * the absence of `TRUST_PROXY_HEADERS`, because an untrusted `x-forwarded-for`
 * is caller-controlled and throttling on it would let anyone lock anyone else
 * out. So the CONTACT keys are the whole defence today, and the test that
 * matters is that neither of them can be varied alone.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { throttleOrderPlacement } from "@/features/orders/server/order.controller";
import type { PlaceOrderInput } from "@/features/orders/server/order.validators";

/**
 * A minimal order, with the contact fields the throttle keys on.
 *
 * Every case uses its OWN email and phone: `rateLimit` holds its buckets in a
 * module-level Map that lives for the whole test file, so two cases sharing a
 * contact would spend each other's budget and the failure would look like a
 * limit that is too tight.
 */
function order(overrides: {
  email: string;
  phone: string;
  paymentMethod?: PlaceOrderInput["paymentMethod"];
}): PlaceOrderInput {
  return {
    items: [{ productSlug: "cake", name: "Cake", price: 100, quantity: 1 }],
    totals: { subtotal: 100, total: 100, itemCount: 1 },
    address: {
      fullName: "A Buyer",
      email: overrides.email,
      phone: overrides.phone,
      addressLine1: "1 Street",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
    },
    paymentMethod: overrides.paymentMethod ?? "cod",
  } as unknown as PlaceOrderInput;
}

/** How many calls go through before the throttle refuses one. */
function accepted(next: (attempt: number) => PlaceOrderInput, ip = ""): number {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      throttleOrderPlacement(next(attempt), ip);
    } catch {
      return attempt;
    }
  }
  return 200;
}

describe("placing an order without signing in", () => {
  it("stops after a handful from the same contact", () => {
    const allowed = accepted(() => order({ email: "one@buyer.test", phone: "9000000001" }));

    expect(allowed, "an anonymous caller can place unlimited COD orders").toBeLessThan(20);
    // Generous enough for a real person who got something wrong and re-ordered.
    expect(allowed, "a customer correcting their order is refused").toBeGreaterThan(1);
  });

  it("does not hand out a fresh budget for a new phone number", () => {
    /**
     * The cheapest way past a single-key limit is to change the one field it
     * reads. Both are required by the address schema, so both are keyed.
     */
    const email = "same@buyer.test";
    const allowed = accepted((attempt) => order({ email, phone: `90000${attempt}0002` }));

    expect(allowed, "changing only the phone bought an unlimited budget").toBeLessThan(20);
  });

  it("does not hand out a fresh budget for a new email either", () => {
    const phone = "9000000003";
    const allowed = accepted((attempt) => order({ email: `a${attempt}@buyer.test`, phone }));

    expect(allowed, "changing only the email bought an unlimited budget").toBeLessThan(20);
  });

  it("is stricter on cash on delivery than on a prepaid order", () => {
    // A prepaid order costs the caller the price of the cake; a COD order costs
    // them nothing and still takes the stock.
    const cod = accepted(() => order({ email: "cod@buyer.test", phone: "9000000004" }));
    const prepaid = accepted(() =>
      order({ email: "paid@buyer.test", phone: "9000000005", paymentMethod: "razorpay" }),
    );

    expect(prepaid, "cash on delivery is throttled no harder than a paid order").toBeGreaterThan(
      cod,
    );
  });

  it("does not turn an absent IP into one bucket for the whole shop", () => {
    /**
     * The mistake this repo already made once, on the enquiry form: keying on
     * `ctx.ip` when it is "" for everybody made the budget shop-wide, and six
     * enquiries in a minute started answering 429 to every visitor.
     *
     * Two different customers, no IP between them: the second must not be
     * spending the first's budget.
     */
    accepted(() => order({ email: "first@buyer.test", phone: "9000000006" }));

    let refused = false;
    try {
      throttleOrderPlacement(order({ email: "second@buyer.test", phone: "9000000007" }), "");
    } catch {
      refused = true;
    }

    expect(refused, "one customer's orders used up another customer's budget").toBe(false);
  });
});

describe("the endpoints behind it", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
  const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

  it("throttles BEFORE the order is placed", () => {
    // After the placement the stock is already gone, which is the thing being
    // protected — a limit applied afterwards protects nothing.
    const code = stripComments(read("features/orders/server/order.controller.ts"));
    const from = code.indexOf("export const placeOrderController");
    expect(from, "the placement controller is gone").toBeGreaterThan(-1);

    const body = code.slice(from, code.indexOf("\n});", from));
    const throttled = body.indexOf("throttleOrderPlacement(");
    const placed = body.indexOf("service.placeOrder(");

    expect(throttled, "an anonymous order is placed with no limit at all").toBeGreaterThan(-1);
    expect(placed).toBeGreaterThan(-1);
    expect(throttled, "the stock is taken before the caller is throttled").toBeLessThan(placed);
  });

  it("throttles the quote endpoint too", () => {
    /**
     * Pricing a cart reserves nothing, so this is not about stock. Every call
     * reads the settings, the coupons, the zones and one product document per
     * line — a loop against it is a database bill and a slow shop for everyone,
     * from an unauthenticated caller, for free.
     */
    const code = stripComments(read("features/checkout/server/checkout.controller.ts"));
    const from = code.indexOf("export const quoteCartController");
    expect(from, "the quote controller is gone").toBeGreaterThan(-1);

    expect(code.slice(from, code.indexOf("\n});", from)), "quoting is unlimited").toContain(
      "rateLimit(",
    );
  });
});
