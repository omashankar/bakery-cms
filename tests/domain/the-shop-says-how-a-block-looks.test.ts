import { describe, expect, it } from "vitest";

import {
  asAddOn,
  asStatement,
  calculateVariantAdjustment,
  getDefaultVariantSelections,
  resolveBlockRender,
} from "@/features/products/lib/variant-utils";
import {
  calculateProductUnitPrice,
  defaultProductUnitPrice,
  formatVariantSummary,
} from "@/features/products/lib/product-pricing";
import type { ProductBlockRender, ProductVariantGroup } from "@/types/product";

/**
 * Three renderings existed. The shop was never allowed to choose between them.
 *
 * The storefront picked by reading the data — two options meant buttons, one
 * option with no default meant a tickbox, one option WITH a default meant a
 * stated fact — and that rule appeared nowhere the merchant could see it. So
 * ticking Default on a lone option silently turned an offer into a claim, and
 * the form said nothing either way.
 *
 * `render` is the shop's own answer. It is OPTIONAL, and that is the entire
 * migration: a group that carries no answer resolves through the same two
 * predicates it always did, so the day this ships nothing on any of the 29 live
 * products moves by one pixel or one rupee. The key is written only when a shop
 * saves a product, freezing what it already looked like.
 *
 * This file holds that promise down from both ends: the derivation still agrees
 * with the old split, and no value of `render` can change what anybody is
 * charged.
 */

const opt = (over: Record<string, unknown> = {}) => ({
  id: "o1",
  label: "A",
  priceAdjustment: 0,
  ...over,
});

const group = (options: unknown[], render?: ProductBlockRender): ProductVariantGroup =>
  ({ id: "g1", name: "Question", type: "custom", ...(render ? { render } : {}), options }) as never;

/** The shapes this shop's 29 products actually store. */
const LIVE = {
  shape: group([
    opt({ id: "round", label: "Round", isDefault: true }),
    opt({ id: "square", label: "Square" }),
    opt({ id: "heart", label: "Heart" }),
  ]),
  eggChoice: group([
    opt({ id: "regular", label: "Regular", isDefault: true }),
    opt({ id: "eggless", label: "Eggless", priceAdjustment: 80 }),
  ]),
  eggOptIn: group([opt({ id: "eggless", label: "Eggless", priceAdjustment: 100 })]),
  shapeStated: group([opt({ id: "round", label: "Round", isDefault: true })]),
};

describe("a block with no answer stored looks exactly as it always did", () => {
  it("draws this shop's three real shapes the way the page draws them today", () => {
    expect(resolveBlockRender(LIVE.shape).render).toBe("buttons");
    expect(resolveBlockRender(LIVE.eggChoice).render).toBe("checkbox");
    expect(resolveBlockRender(LIVE.eggOptIn).render).toBe("checkbox");
    expect(resolveBlockRender(LIVE.shapeStated).render).toBe("stated");
  });

  it("agrees with the two predicates the page used before, over a table", () => {
    /**
     * The derivation is not re-implemented here — that would be a second copy
     * of the rule agreeing with itself. It is compared AGAINST the predicates,
     * which are the rule, and which this change deliberately does not touch.
     */
    const table = [
      group([opt({ isDefault: true })]),
      group([opt({ isDefault: true, priceAdjustment: 250 })]),
      group([opt()]),
      group([opt({ priceAdjustment: 80 })]),
      group([opt({ isDefault: true }), opt({ id: "b", priceAdjustment: 60 })]),
      group([opt({ isDefault: true }), opt({ id: "b" })]),
      group([opt({ isDefault: true }), opt({ id: "b", isDefault: true })]),
      group([opt(), opt({ id: "b" }), opt({ id: "c" })]),
      group([]),
      LIVE.shape,
      LIVE.eggChoice,
      LIVE.eggOptIn,
      LIVE.shapeStated,
    ];

    for (const [index, entry] of table.entries()) {
      const expected = asStatement(entry) ? "stated" : asAddOn(entry) ? "checkbox" : "buttons";
      expect(resolveBlockRender(entry).render, `row ${index}`).toBe(expected);
    }
  });

  it("hands the tick row the same pair the old predicate handed it", () => {
    /**
     * Membership and the on/off pair used to come from two separate reads, and
     * a block could be in the bucket with a null pair — which the row below
     * then dereferenced. They come out of one decision now, so this asserts they
     * still describe the same tick.
     */
    const resolved = resolveBlockRender(LIVE.eggChoice);

    expect(resolved.render).toBe("checkbox");
    if (resolved.render !== "checkbox") throw new Error("unreachable");
    expect(resolved.tick).toEqual(asAddOn(LIVE.eggChoice));
  });
});

describe("no answer the shop gives can move a price", () => {
  it("charges the same whatever the block says it looks like", () => {
    /**
     * THE property this whole design rests on. `render` is a word about
     * drawing, and every price function in the shop reads ids, defaults and
     * adjustments — never this key. Asserted over all four public entry points
     * rather than reasoned about, because "money cannot move" is the promise
     * being made to a live shop.
     */
    const renders: (ProductBlockRender | undefined)[] = [
      undefined,
      "buttons",
      "checkbox",
      "stated",
    ];

    for (const source of [LIVE.shape, LIVE.eggChoice, LIVE.eggOptIn, LIVE.shapeStated]) {
      const priced = renders.map((render) => {
        const g = group(source.options as never, render);
        const defaults = getDefaultVariantSelections([g]);
        return [
          calculateVariantAdjustment([g], {}),
          calculateVariantAdjustment([g], defaults),
          calculateProductUnitPrice({ basePrice: 999, variantGroups: [g], variantSelections: defaults }),
          defaultProductUnitPrice({ price: 999, weights: [{ price: 1199 }], variantGroups: [g] }),
        ].join("|");
      });

      expect(new Set(priced).size, `${source.options.length}-option block: ${priced.join("  ")}`).toBe(1);
    }
  });

  it("and says the same thing on the order line", () => {
    // The kitchen ticket and the invoice read `formatVariantSummary`, which is
    // built from names and labels. A rendering word must not reach it.
    const plain = group(LIVE.shapeStated.options as never);
    const stated = group(LIVE.shapeStated.options as never, "stated");

    expect(formatVariantSummary([stated], getDefaultVariantSelections([stated]))).toEqual(
      formatVariantSummary([plain], getDefaultVariantSelections([plain])),
    );
  });
});

describe("an answer the block cannot honour", () => {
  it("falls back to the drawing that fits the data", () => {
    /**
     * The form is where a shop is told its block does not fit; a customer's page
     * is not the place to argue with the data. A three-option block asked to be
     * a tickbox draws as buttons rather than as nothing.
     */
    const impossible = group(LIVE.shape.options as never, "stated");
    expect(resolveBlockRender(impossible).render).toBe("buttons");

    const alsoImpossible = group(LIVE.shape.options as never, "checkbox");
    expect(resolveBlockRender(alsoImpossible).render).toBe("buttons");

    const noPress = group([opt({ isDefault: true })], "buttons");
    expect(resolveBlockRender(noPress).render).toBe("stated");
  });

  it("never returns a tick with nothing to tick", () => {
    /**
     * The crash this shape was chosen to prevent. A two-option block declared a
     * checkbox whose options carry NO default is reachable today — re-ticking
     * the ticked option in the editor clears every default — and the old shape
     * put it in the tick bucket while the pair came back null.
     */
    const noDefault = group([opt(), opt({ id: "b", priceAdjustment: 60 })], "checkbox");
    const resolved = resolveBlockRender(noDefault);

    if (resolved.render === "checkbox") expect(resolved.tick.on).toBeTruthy();
    else expect(resolved.render).toBe("buttons");
  });

  it("refuses a tick whose unticked side costs more", () => {
    // It would start unticked at the HIGHER price, so the page and the grid
    // card — which prices each block's default — would disagree by that much.
    const backwards = group(
      [opt({ isDefault: true, priceAdjustment: 200 }), opt({ id: "b", priceAdjustment: 0 })],
      "checkbox",
    );

    expect(resolveBlockRender(backwards).render).toBe("buttons");
  });
});

describe("what a declared answer buys the shop", () => {
  it("lets a free yes-or-no be a tickbox", () => {
    /**
     * The derivation refuses this, and is right to: with no price to tell two
     * free options apart it cannot know which side is "off", and picking one
     * would be an invention. Once the shop has said "tickbox" there is nothing
     * left to invent — the default is the off state.
     */
    const giftWrap = group([
      opt({ id: "no", label: "No", isDefault: true }),
      opt({ id: "yes", label: "Yes" }),
    ]);

    expect(resolveBlockRender(giftWrap).render).toBe("buttons");
    expect(resolveBlockRender(group(giftWrap.options as never, "checkbox")).render).toBe("checkbox");
  });

  it("but still refuses one whose off-state depends on list order", () => {
    /**
     * `asAddOn` falls back to `options[0]` for a group naming no default. This
     * change hands the shop arrows that MOVE `options[0]`, so a tick built that
     * way would change what it charges when somebody tidies the list. A declared
     * two-option tick needs a named default; without one it draws as buttons,
     * where the customer picks and nothing is assumed.
     */
    const orderDependent = group([opt({ id: "a" }), opt({ id: "b", priceAdjustment: 60 })], "checkbox");

    expect(resolveBlockRender(orderDependent).render).toBe("buttons");
  });

  it("and leaves the derivation's own ALLOWANCES alone too", () => {
    /**
     * The relaxed rule is stricter in one place as well as looser in another: a
     * declared tick needs a NAMED default, where the derivation falls back to
     * `options[0]`. Applying the strict half to derived blocks would silently
     * turn a two-option group that names no default from a tick into buttons.
     *
     * Not in this shop's data today — every multi-option group names a default —
     * but `normalizeVariantGroups` only backfills one when the KEY is absent,
     * and re-ticking the ticked option in the editor clears them all. So it is
     * one keystroke away, and the rendering must not move under it.
     */
    const noNamedDefault = group([opt({ id: "a" }), opt({ id: "b", priceAdjustment: 80 })]);

    expect(asAddOn(noNamedDefault), "the derivation still resolves this").not.toBeNull();
    const resolved = resolveBlockRender(noNamedDefault);
    expect(resolved.render).toBe("checkbox");
    if (resolved.render !== "checkbox") throw new Error("unreachable");
    expect(resolved.tick).toEqual(asAddOn(noNamedDefault));
  });

  it("and leaves the derivation's own refusals alone", () => {
    /**
     * The relaxation is for DECLARED blocks only. Substituted into the
     * derivation it would flip every free two-option block in this shop —
     * 28 Shape groups — from buttons to ticks on the day it shipped.
     */
    const freePair = group([
      opt({ id: "a", label: "Round", isDefault: true }),
      opt({ id: "b", label: "Square" }),
    ]);

    expect(asAddOn(freePair)).toBeNull();
    expect(resolveBlockRender(freePair).render).toBe("buttons");
  });
});
