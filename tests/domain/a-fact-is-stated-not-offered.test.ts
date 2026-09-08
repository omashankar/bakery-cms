import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  asAddOn,
  asStatement,
  calculateVariantAdjustment,
  getDefaultVariantSelections,
} from "@/features/products/lib/variant-utils";
import { formatVariantSummary } from "@/features/products/lib/product-pricing";
import { getCartItems } from "@/features/cart/lib/cart";

/**
 * A cake that is only made one way is not asking a question.
 *
 * `asAddOn` has said so in prose since it was written: "One option WITH a
 * default is not this. That is a fact about the product — it comes this way —
 * and a box the customer cannot untick is not a choice." It then returned null
 * and left the group to the picker path, where it rendered as a bold heading
 * over a single already-pressed button. The page showed the customer a control
 * that controlled nothing, three times over on this shop's live catalogue.
 *
 * The shop owner sent a screenshot of what he wanted instead — a tick and a
 * word, under the size picker:
 *
 *     ✓ Eggless
 *
 * This file is the rest of that sentence. The predicate reads an option count,
 * one boolean and whether the label is blank, and NOTHING about what the words
 * mean — so a hardware shop gets "✓ Waterproof" and a furniture shop gets
 * "✓ Ships assembled" without this software learning either trade.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/store/cakes/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/reviews/lib/reviews-api", () => ({
  fetchApprovedReviews: async () => [],
  submitReview: async () => ({ ok: true }),
}));

const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");

/** One option, and the shop ticked Default. The shape a fact actually has. */
const EGGLESS_FACT = {
  id: "g-egg",
  name: "Egg preference",
  type: "custom",
  options: [{ id: "eggless", label: "Eggless", priceAdjustment: 0, isDefault: true }],
};

/** The same shape with the tick cleared: an offer, not a fact. */
const EGGLESS_OFFER = {
  ...EGGLESS_FACT,
  id: "g-egg-offer",
  options: [{ id: "eggless", label: "Eggless", priceAdjustment: 80, isDefault: false }],
};

const SHAPE_CHOICE = {
  id: "g-shape",
  name: "Shape",
  type: "shape",
  options: [
    { id: "round", label: "Round", priceAdjustment: 0, isDefault: true },
    { id: "square", label: "Square", priceAdjustment: 0 },
    { id: "heart", label: "Heart", priceAdjustment: 200 },
  ],
};

const CAKE = {
  id: "p-1",
  name: "Eggless Red Velvet",
  slug: "eggless-red-velvet",
  description: "",
  price: 999,
  image: "/cake.jpg",
  category: "Cakes",
  inStock: true,
  weights: [],
  shapes: [],
  variantGroups: [EGGLESS_FACT, SHAPE_CHOICE],
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render(cake: unknown = CAKE, modules = defaultModuleSettings) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(ProductDetailPage, { cake, modules, related: [], catalog: [] } as never),
    );
  });
  return container;
}

function click(element: Element | undefined) {
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function addToCart() {
  click(
    [...(container?.querySelectorAll("button") ?? [])].find((node) =>
      node.textContent?.includes("Add to Cart"),
    ),
  );
  return getCartItems()[0];
}

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  window.localStorage.clear();
});

describe("telling a fact from a question", () => {
  const g = (options: unknown[]) => ({ id: "g", name: "G", type: "custom", options }) as never;
  const opt = (over: Record<string, unknown> = {}) => ({
    id: "o",
    label: "A",
    priceAdjustment: 0,
    ...over,
  });

  it("is one option that the shop marked as the answer", () => {
    expect(asStatement(EGGLESS_FACT as never)?.label).toBe("Eggless");
  });

  it("is not one option the shop left open", () => {
    // The tick cleared means "you can have this if you ask" — an offer, and the
    // customer must be able to decline it. Two live products are this shape.
    expect(asStatement(EGGLESS_OFFER as never)).toBeNull();
  });

  it("is not a tick with nothing after it", () => {
    // Reachable: the variant schema types options loosely, so a blank label can
    // be stored. A bare green glyph reads as a rendering fault, not as data.
    expect(asStatement(g([opt({ isDefault: true, label: "   " })]))).toBeNull();
    expect(asStatement(g([opt({ isDefault: true, label: "" })]))).toBeNull();
  });

  it("is never two answers, however they are marked", () => {
    expect(asStatement(SHAPE_CHOICE as never)).toBeNull();
    expect(asStatement(g([opt({ isDefault: true }), opt({ id: "b", isDefault: true })]))).toBeNull();
    expect(asStatement(g([]))).toBeNull();
  });

  it("and every group lands in exactly one of the three", () => {
    /**
     * The buckets are read as "an add-on", "a statement", and "everything
     * else" — so two of them overlapping renders a group TWICE, once as the
     * heading-and-button this change exists to remove and once as its own tick
     * directly underneath. The partition is what makes that impossible, rather
     * than the three call sites agreeing to be careful.
     */
    const table = [
      g([opt({ isDefault: true })]),
      g([opt({ isDefault: true, priceAdjustment: 250 })]),
      g([opt()]),
      g([opt({ priceAdjustment: 80 })]),
      g([opt({ isDefault: true }), opt({ id: "b", priceAdjustment: 60 })]),
      g([opt({ isDefault: true }), opt({ id: "b" })]),
      g([opt({ isDefault: true }), opt({ id: "b", isDefault: true })]),
      SHAPE_CHOICE as never,
      g([]),
    ];

    for (const [index, group] of table.entries()) {
      const both = asAddOn(group) !== null && asStatement(group) !== null;
      expect(both, `row ${index} of the table is in two buckets`).toBe(false);
    }
  });

  it("leaves what an add-on is alone", () => {
    /**
     * `asAddOn` is the fence. If a fact could be smuggled into the tick path a
     * customer could untick something the page called already true — and the
     * two live paid opt-ins (₹80 and ₹100) would become free facts.
     */
    expect(asAddOn(EGGLESS_OFFER as never)).toEqual({
      off: null,
      on: EGGLESS_OFFER.options[0],
      extra: 80,
    });
    expect(asAddOn(EGGLESS_FACT as never)).toBeNull();
  });
});

describe("what the page shows", () => {
  it("states it, rather than offering it", () => {
    const html = render().innerHTML;

    expect(html).toContain("Eggless");
    // Not a heading over one dead button, which is what it was.
    expect(html).not.toContain(">Egg preference<");
    // …and the real choice beside it is untouched.
    expect(html).toContain(">Shape<");
  });

  it("gives it nothing to click", () => {
    /**
     * A bordered box invites a press. The count is asserted rather than the
     * absence of one, because this page has other tickboxes and a statement
     * joining them would look clearable while doing nothing.
     */
    render();
    const ticks = container?.querySelectorAll('[data-slot="checkbox"]') ?? [];

    expect(ticks.length).toBe(0);
    expect(container?.querySelectorAll("li")?.length).toBeGreaterThan(0);
  });

  it("does not say it twice", () => {
    /**
     * The grey line under the price prints every answered group, and a
     * statement is answered from the first paint — so the cake said "Eggless"
     * as a tick and "Egg preference: Eggless" forty pixels above it. The same
     * duplication the serving line was deleted for.
     */
    const text = render().textContent ?? "";

    expect(text).not.toContain("Egg preference: Eggless");
    // The choice beside it still appears there, so this is not the whole line
    // being dropped.
    expect(text).toContain("Shape: Round");
  });

  it("never prints a price beside the fact, because the price above contains it", () => {
    /**
     * This asserted the opposite for one release, and the shop's own page
     * proved it wrong. Ring Ceremony Special Cake states Eggless at +₹80 under
     * a price of ₹1,079 — which is its ₹999 base plus that same ₹80. Printing
     * "+₹80" beside the words tells a customer reading ₹1,079 to expect ₹1,159.
     *
     * A default is inside the displayed price by construction, so the amount is
     * disclosed once, in the only place a total can be right when several
     * groups carry one.
     */
    const view = render({
      ...CAKE,
      variantGroups: [
        {
          id: "g-finish",
          name: "Finish",
          type: "custom",
          options: [
            { id: "gold", label: "Gold leaf", priceAdjustment: 250, isDefault: true },
          ],
        },
      ],
    });

    const row = [...view.querySelectorAll("li")].find((node) =>
      node.textContent?.includes("Gold leaf"),
    );

    expect(row?.textContent?.trim()).toBe("Gold leaf");
    // …and the 250 is in the figure above it, exactly once.
    expect(view.textContent).toContain("₹1,249");
    expect(view.textContent).not.toContain("+₹250");
  });

  it("sits above the things that can be ticked", () => {
    /**
     * A statement and an add-on look alike and behave completely differently.
     * Keeping the block whole and above the ticks is what stops a customer
     * reaching for one and finding it dead.
     */
    const view = render({
      ...CAKE,
      variantGroups: [EGGLESS_FACT, { ...EGGLESS_OFFER, name: "Gift wrap" }],
    });

    const statement = view.querySelector("li");
    const tick = view.querySelector('[data-slot="checkbox"]');

    expect(statement, "no statement rendered").toBeTruthy();
    expect(tick, "no tick rendered").toBeTruthy();
    expect(
      statement!.compareDocumentPosition(tick!) & Node.DOCUMENT_POSITION_FOLLOWING,
      "the statement is not before the tick",
    ).toBeTruthy();
  });

  it("reads back whatever the shop typed, in any trade", () => {
    /**
     * THE constraint. The shop sells more than cake, and nothing in this
     * rendering may know what a cake is. Nonsense words on purpose: if the code
     * ever grows a special case for a food word, this fails and nothing else in
     * the suite would — the bakery-wording ratchet's TRADE regex matches
     * neither "egg" nor "eggless".
     */
    const view = render({
      ...CAKE,
      name: "Zorbium Mount",
      variantGroups: [
        {
          id: "g-x",
          name: "Grebbling",
          type: "custom",
          options: [{ id: "o-x", label: "Flarn-treated", priceAdjustment: 0, isDefault: true }],
        },
      ],
    });

    const row = [...view.querySelectorAll("li")].find((node) =>
      node.textContent?.includes("Flarn-treated"),
    );

    /**
     * EXACTLY the shop's word, and nothing beside it.
     *
     * `toContain` is what this asserted first, and a mutation walked through
     * it: prefixing the label with a hard-coded "Eggless" still contains
     * "Flarn-treated". A source scan was tried next and was worse — the block
     * is one JSX expression, so every way of counting braces either saw
     * everything or nothing, and the version that saw nothing passed.
     *
     * The rendered string cannot be argued with. If this software ever learns a
     * food word, it appears here.
     */
    expect(row?.textContent?.trim()).toBe("Flarn-treated");
  });
});

describe("what the kitchen is told", () => {
  it("still gets the fact on the line", () => {
    /**
     * The rendering change must be a rendering change ONLY. If the group were
     * filtered out of the visible list, or its default never seeded, the page
     * would print "✓ Eggless" while the cart line said nothing — and the
     * kitchen would bake the wrong cake. The two summary memos are one
     * keystroke apart, so this is the fence around them.
     */
    render();
    const line = addToCart();

    expect(line?.variantSummary).toContain("Egg preference: Eggless");
    expect(line?.variantSelections?.[EGGLESS_FACT.id]).toBe("eggless");
  });

  it("charges exactly what it charged before", () => {
    render();

    expect(addToCart()?.price).toBe(999);
    expect(calculateVariantAdjustment([EGGLESS_FACT] as never, {})).toBe(0);
    expect(getDefaultVariantSelections([EGGLESS_FACT] as never)).toEqual({ "g-egg": "eggless" });
    expect(formatVariantSummary([EGGLESS_FACT] as never, { "g-egg": "eggless" })).toEqual([
      "Egg preference: Eggless",
    ]);
  });

  it("and a priced fact is charged once, not twice", () => {
    const finish = {
      id: "g-finish",
      name: "Finish",
      type: "custom",
      options: [{ id: "gold", label: "Gold leaf", priceAdjustment: 250, isDefault: true }],
    };
    render({ ...CAKE, variantGroups: [finish] });

    expect(addToCart()?.price).toBe(1249);
  });
});

describe("a module the shop switched off", () => {
  it("takes its statement with it", () => {
    /**
     * The split is built over the groups that survive `variantGroupsEnabledBy`,
     * not over the raw list — so a shape-typed fact is never BUILT when Shape is
     * off, rather than rendered and hidden. Building it from the raw list would
     * put a statement on the page for something the shop is not selling and not
     * charging for.
     */
    const view = render(
      {
        ...CAKE,
        variantGroups: [{ ...SHAPE_CHOICE, options: [SHAPE_CHOICE.options[0]] }],
      },
      { ...defaultModuleSettings, shape: false },
    );

    expect(view.textContent).not.toContain("Round");
    expect(addToCart()?.variantSummary ?? []).toEqual([]);
  });

  it("and carries the gate attribute so the pre-paint rule can reach it", () => {
    const view = render({
      ...CAKE,
      variantGroups: [{ ...SHAPE_CHOICE, options: [SHAPE_CHOICE.options[0]] }],
    });

    expect(view.querySelector("li[data-gate-shape]"), "the statement carries no gate").toBeTruthy();
  });
});
