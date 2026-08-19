/**
 * What the Commerce screen says about payment methods has to be what checkout
 * offers.
 *
 * It listed "COD · UPI · Card · Razorpay" and counted four. Checkout offers
 * two: Cash on Delivery, and Pay Online — and Pay Online IS UPI and cards, so
 * the other two were the same thing counted twice more.
 *
 * The `upi` and `card` settings are not switches anyone turned off; nothing
 * switches them. `setGatewayEnabled` writes only `cod` and `razorpay` — the two
 * gateways the shop can collect with — so those two values sit at their
 * defaults for the life of a shop. Listing them invented control the owner does
 * not have and would have sent them hunting for a switch that does not exist.
 *
 * Source-level, because the defect is a sentence rather than a value: nothing
 * computes a wrong answer here, the screen simply says something that is not
 * true of the shop it is describing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/**
 * The two the shop can actually collect with — read from the gateway settings
 * rather than written down here, so this cannot drift from the thing it checks.
 */
function collectableMethods(): string[] {
  const source = stripComments(read("features/payments/lib/payment-gateway-settings.ts"));
  const at = source.indexOf("const CORE = new Set(");
  expect(at, "the set of collectable gateways is gone").toBeGreaterThan(-1);

  return [...source.slice(at, source.indexOf(")", at)).matchAll(/"([a-z]+)"/g)].map(
    (match) => match[1],
  );
}

describe("the Commerce settings screen", () => {
  const screen = () =>
    stripComments(read("apps/admin/settings/components/commerce-settings-page.tsx"));

  it("counts only the methods a customer can actually pay with", () => {
    const source = screen();
    const at = source.indexOf("const livePaymentMethodsOn");
    expect(at, "the payment-method count is gone").toBeGreaterThan(-1);

    const count = source.slice(at, source.indexOf(";", source.indexOf("filter", at)));
    const collectable = collectableMethods();

    // Every gateway that CAN collect is counted...
    for (const method of collectable) {
      expect(count, `the count leaves out ${method}, which checkout offers`).toContain(
        `paymentMethods.${method}`,
      );
    }

    // ...and nothing else is. `upi` and `card` are the ones that were.
    const counted = [...count.matchAll(/paymentMethods\.([a-z]+)/g)].map((match) => match[1]);
    expect(
      counted.filter((method) => !collectable.includes(method)),
      "these are counted as payment methods but no customer can choose them",
    ).toEqual([]);
  });

  it("names them the way the customer meets them", () => {
    const source = screen();
    const at = source.indexOf("No payment methods enabled");
    expect(at, "the payment-method summary line is gone").toBeGreaterThan(-1);

    // The list is built just above its own fallback.
    const list = source.slice(source.lastIndexOf("{[", at), at);
    const collectable = collectableMethods();
    const listed = [...list.matchAll(/paymentMethods\.([a-z]+)/g)].map((match) => match[1]);

    expect(
      listed.filter((method) => !collectable.includes(method)),
      "these are listed to the owner but reach no checkout",
    ).toEqual([]);
    expect(listed.length, "the summary line stopped naming anything").toBeGreaterThan(0);

    /**
     * And not by the gateway's brand.
     *
     * "Razorpay" is the company that moves the money; the customer sees one
     * "Pay Online" button. An owner reading a processor's name has to already
     * know it covers UPI and cards to know what their shop accepts — which is
     * the question this line exists to answer.
     */
    expect(list, "the line names the processor instead of what it accepts").toMatch(/UPI/i);
    expect(list).toMatch(/card/i);
  });
});

describe("the legacy payment-method settings", () => {
  it("are still in the shape, so old documents and backups still validate", () => {
    // Deleting the field would make the Zod schema reject settings this shop
    // has already stored, and every backup file an owner has taken.
    const settings = read("types/settings.ts");
    const at = settings.indexOf("interface PaymentMethodSettings");
    const shape = settings.slice(at, settings.indexOf("}", at));

    expect(shape).toContain("upi");
    expect(shape).toContain("card");
  });

  it("gate nothing, anywhere", () => {
    /**
     * The whole point. A screen may still carry the values; what it must not do
     * is decide anything with them.
     *
     * Swept rather than listed — the last two places that read these were found
     * by reading the tree, and a list of two would not have noticed a third.
     */
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
          walk(path);
        } else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
          const code = stripComments(read(path));
          for (const method of ["upi", "card"]) {
            if (code.includes(`paymentMethods.${method}`)) offenders.push(`${path} — ${method}`);
          }
        }
      }
    };

    for (const root of ["apps", "features", "components", "app"]) walk(root);

    expect(
      offenders,
      `these read a payment-method setting nothing can switch:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
