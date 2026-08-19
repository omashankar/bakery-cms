/**
 * The number on the screen and the number the gateway takes must be the same
 * number.
 *
 * Admin → Settings → General offers INR, USD, EUR and GBP, and every price the
 * customer sees is formatted in whichever is set — the cart, the invoice, the
 * confirmation email, the admin's revenue figures. The Razorpay order was
 * created with a hard-coded `currency: "INR"` regardless.
 *
 * So a shop on USD displayed "$1,200.00" and asked Razorpay for ₹1,200 —
 * roughly a fourteenth of it — while the order recorded the amount the customer
 * was never charged. Both numbers look deliberate, which is what makes it worse
 * than an obvious failure: nothing errors, the payment succeeds, and the
 * mismatch surfaces at settlement or in a dispute.
 *
 * The fix is not conversion. There is no exchange rate anywhere in this system
 * and inventing one would be a second wrong number, and Razorpay can only take
 * a foreign currency if the account has international payments enabled — a
 * setting on their side this code cannot see. So: charge what was quoted, and
 * when the gateway cannot, refuse and say so BEFORE the customer has filled in
 * an address and pressed Pay.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  RAZORPAY_CURRENCY,
  isRazorpayChargeable,
} from "@/features/payments/lib/razorpay-currency";
import { currencyOptions } from "@/features/settings/lib/settings-utils";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("which currencies this gateway can take", () => {
  it("accepts the one it is wired for", () => {
    expect(isRazorpayChargeable(RAZORPAY_CURRENCY)).toBe(true);
  });

  it("refuses every OTHER currency the settings screen offers", () => {
    /**
     * Read from the picker rather than listed here, so adding a currency to the
     * admin dropdown cannot quietly become a currency the gateway is charged in
     * without anyone deciding that.
     */
    const others = currencyOptions
      .map((option) => option.value)
      .filter((code) => code !== RAZORPAY_CURRENCY);

    expect(others.length, "the settings screen offers only one currency now").toBeGreaterThan(0);

    for (const code of others) {
      expect(isRazorpayChargeable(code), `${code} would be charged as ${RAZORPAY_CURRENCY}`).toBe(
        false,
      );
    }
  });

  it("is not fooled by whitespace or case in a stored setting", () => {
    // The value comes from a settings document that predates the Zod enum
    // constraining it, so it is not guaranteed to be a clean upper-case code.
    expect(isRazorpayChargeable(" inr ")).toBe(true);
    expect(isRazorpayChargeable("Inr")).toBe(true);
  });

  it("refuses a missing currency rather than assuming its own", () => {
    // An absent setting is not evidence the shop is on INR, and guessing is how
    // the wrong amount gets charged in the first place.
    expect(isRazorpayChargeable(undefined)).toBe(false);
    expect(isRazorpayChargeable(null)).toBe(false);
    expect(isRazorpayChargeable("")).toBe(false);
  });
});

describe("the order the gateway is asked to create", () => {
  const route = () => stripComments(read("app/api/razorpay/order/route.ts"));

  it("is denominated in the shop's currency, not a constant", () => {
    const code = route();
    const at = code.indexOf("orders.create(");
    expect(at, "the gateway order is no longer created here").toBeGreaterThan(-1);

    const call = code.slice(at, code.indexOf("});", at));

    expect(call, "the gateway is charged in a hard-coded currency again").not.toMatch(
      /currency:\s*["']/,
    );
    expect(call, "the gateway order carries no currency at all").toContain("currency");
  });

  it("refuses before charging when the shop's currency is one it cannot take", () => {
    const code = route();
    const guard = code.indexOf("isRazorpayChargeable(");
    const charge = code.indexOf("orders.create(");

    expect(guard, "nothing checks the shop's currency before charging").toBeGreaterThan(-1);
    expect(guard, "the currency is checked after the card has been charged").toBeLessThan(charge);
  });
});

describe("the customer finds out before they pay", () => {
  it("is reported by the same endpoint checkout already asks", () => {
    /**
     * Reusing `configured` rather than adding a field checkout might not read.
     *
     * The rule at checkout is "hide Pay Online unless the server says yes", and
     * a shop whose currency this gateway cannot take is a shop where online
     * payment is not available. Offering it and refusing at the final click is
     * the failure the missing-keys path was already fixed for: the customer
     * fills in an address, picks a slot, presses Pay, and only then finds out.
     */
    const code = stripComments(read("app/api/razorpay/availability/route.ts"));

    expect(code, "availability never looks at the shop's currency").toContain(
      "isRazorpayChargeable(",
    );

    const answer = code.slice(code.indexOf("return Response.json("));
    expect(answer, "the currency check does not reach the flag checkout reads").toMatch(
      /configured:[^,]*chargeable/,
    );
  });

  it("still tells the ADMIN which of the two is wrong", () => {
    // "No keys" and "wrong currency" need completely different things done
    // about them, and the admin is the one who has to do them.
    const code = stripComments(read("app/api/razorpay/availability/route.ts"));
    const answer = code.slice(code.indexOf("return Response.json("));

    expect(answer).toContain("currencySupported");
    expect(answer).toContain("currency");
  });
});
