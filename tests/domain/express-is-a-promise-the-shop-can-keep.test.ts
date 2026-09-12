/**
 * SPEC §14: "The products shown under Express must be based on actual delivery
 * eligibility. Do NOT simply create a static Express category."
 *
 * Delivery was shop-wide. One cutoff, one set of speeds, and not a single field
 * on a product about any of it — so every product was express-eligible by
 * definition, and an Express page would have been the whole catalogue wearing a
 * different heading. That IS the static category the requirement refuses, just
 * built the long way round.
 *
 * A product now says which speeds it can go out by, and the rule everything
 * reads is one function:
 *
 *   EMPTY OR ABSENT MEANS EVERY SPEED.
 *
 * That is not a convenience. It is what every product in every shop means
 * today, and any other reading makes an entire live catalogue undeliverable on
 * the day this ships.
 *
 * And §15's rule applies here too, in the spec's own words: "Do not create a
 * setting that is only stored in the database but does nothing." A speed the
 * product page refuses and the SERVER accepts is decoration — so the refusal
 * lives in `priceCart`, which is where the money is decided, and both endpoints
 * that reach it turn it into a 409 a customer can act on.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { deliverableBy } from "@/features/products/lib/products-repository";
import { getFilterDeliveryOptions } from "@/apps/website/lib/collection-filters";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const TIERS = [
  { id: "tier-2h", label: "2 Hour Delivery" },
  { id: "tier-same", label: "Same Day" },
  { id: "tier-std", label: "Standard" },
];

describe("which speeds a product can go out by", () => {
  it("says yes to everything when the shop has not narrowed it", () => {
    /**
     * The compatibility case, and the one that would take a live shop down.
     * Not one product in any shop carries this field.
     */
    expect(deliverableBy({}, "tier-2h")).toBe(true);
    expect(deliverableBy({ deliveryTierIds: [] }, "tier-2h")).toBe(true);
  });

  it("says yes only to the speeds the shop listed", () => {
    const weddingCake = { deliveryTierIds: ["tier-std"] };

    expect(deliverableBy(weddingCake, "tier-std")).toBe(true);
    expect(deliverableBy(weddingCake, "tier-2h"), "a tier-cake in two hours").toBe(false);
  });

  it("and a product listing only tiers the shop deleted can go out by none", () => {
    /**
     * Deliberate, and the opposite of what a `?? all` fallback would do.
     * Treating an unresolvable list as "every speed" quietly re-enables
     * two-hour delivery on a wedding cake because somebody tidied the delivery
     * settings — a silent change to a promise the shop cannot keep. Refusing is
     * the answer an owner notices and can correct.
     */
    expect(deliverableBy({ deliveryTierIds: ["tier-gone"] }, "tier-2h")).toBe(false);
  });
});

describe("the Express page shows what is actually express", () => {
  it("offers a speed only when something on the page can be sent by it", () => {
    const onlyStandard = [{ deliveryTierIds: ["tier-std"] }];

    expect(getFilterDeliveryOptions(onlyStandard, TIERS).map((t) => t.id)).toEqual(["tier-std"]);
  });

  it("offers every speed on a shop that has narrowed nothing", () => {
    // An untouched shop filters nothing out, which is exactly right — it has
    // not told anyone that any product is slower than any other.
    const untouched = [{}, { deliveryTierIds: [] }];

    expect(getFilterDeliveryOptions(untouched, TIERS)).toHaveLength(3);
  });

  it("offers nothing when the page is empty", () => {
    expect(getFilterDeliveryOptions([], TIERS)).toEqual([]);
  });

  it("never offers a speed the shop does not sell", () => {
    /**
     * Driven by the SHOP's tier list, not by the ids on the products — a
     * product carrying a deleted tier must not resurrect it as a filter box
     * that matches one product and hides everything else.
     */
    const stale = [{ deliveryTierIds: ["tier-gone"] }];

    expect(getFilterDeliveryOptions(stale, TIERS)).toEqual([]);
  });
});

describe("the speed is enforced where the money is decided", () => {
  it("priceCart refuses a speed the product cannot go out by", () => {
    /**
     * Server-side or nowhere. A browser-only check is one the customer can skip
     * by editing a request, and the outcome it prevents — charging the express
     * fee and sending it next week — is the one worse than a refusal.
     */
    const pricing = code("features/checkout/server/pricing.server.ts");

    expect(pricing).toContain("deliverableBy(product, chosenTier.id)");
    expect(pricing).toContain("UndeliverableAtSpeedError");
  });

  it("and checks against a tier the shop STILL offers", () => {
    /**
     * `chosenTier` is resolved through the shop's own list, so an id naming a
     * deleted tier is `undefined` and no check runs — the same fall-through
     * `calculateCartTotals` already takes when it charges the base fee. If the
     * two disagreed, checkout would refuse an order the shop can fulfil and
     * charge for a speed it is not being held to.
     */
    const pricing = code("features/checkout/server/pricing.server.ts");

    expect(pricing).toMatch(/chosenTier\s*=\s*input\.deliveryTierId/);
    expect(pricing).toContain("deliveryTiers ?? []).find((tier) => tier.id === input.deliveryTierId)");
    expect(pricing).toContain("if (chosenTier && !deliverableBy(");
  });

  it("and BOTH endpoints that price a cart answer 409, not 500", () => {
    /**
     * The quote endpoint and the draft-less COD placement reach the same
     * pricing. Handling it in one leaves the check one endpoint deep, and an
     * unhandled throw is a 500 — which reads to a customer as the shop being
     * broken rather than as a choice they can change.
     */
    for (const path of [
      "features/checkout/server/checkout.controller.ts",
      "features/orders/server/order.service.ts",
    ]) {
      const source = code(path);
      expect(source, `${path} does not handle it`).toContain("UndeliverableAtSpeedError");
      expect(source).toMatch(/UndeliverableAtSpeedError[\s\S]{0,400}409/);
    }
  });

  it("and the refusal names the product and the speed", () => {
    /**
     * "Your order cannot go out at that speed" over a six-line cart is an error
     * nobody can act on. The customer has to know which product to remove, or
     * which speed to drop to.
     */
    const pricing = code("features/checkout/server/pricing.server.ts");

    expect(pricing).toContain("readonly productName: string");
    expect(pricing).toContain("readonly tierLabel: string");
  });
});

describe("the field survives the trip to the database", () => {
  it("is declared on the Mongoose schema", () => {
    /**
     * Undeclared, strict mode drops it on every write while the API answers
     * 200 and the admin re-renders its own state as though it had saved — the
     * failure this repo has hit four times.
     */
    const model = code("lib/server/db/models/product.model.ts");

    expect(model).toMatch(/deliveryTierIds:\s*\{\s*type:\s*\[String\],\s*default:\s*\[\]\s*\}/);
  });

  it("and on the validator, which strips what it does not declare", () => {
    const validators = code("features/products/server/product.validators.ts");

    expect(validators).toContain("deliveryTierIds: z.array(z.string()).default([])");
  });

  it("and reaches the browser, or the filter has nothing to read", () => {
    /**
     * `toCard` is the narrow projection the cart, checkout and listing pages
     * actually receive. A field missing from it persists perfectly and is never
     * seen — the same whitelist this repo has already lost a field to.
     */
    const service = code("features/products/data/products-service.ts");

    expect(service).toContain("deliveryTierIds: product.deliveryTierIds");
  });
});
