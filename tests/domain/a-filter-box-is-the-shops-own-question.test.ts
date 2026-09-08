import { readFileSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CollectionFiltersPanel } from "@/components/storefront/collection-filters-panel";
import {
  applyCollectionFilters,
  countActiveFilters,
  DEFAULT_COLLECTION_FILTERS,
  defaultCollectionFilters,
  getFilterOptionFacets,
  optionFacetKey,
  pruneOptionSelections,
  type CollectionFilters,
} from "@/apps/website/lib/collection-filters";
import { searchProducts } from "@/features/products/lib/product-catalog";
import type { LandingProduct } from "@/constants/landing-data";

/**
 * The sidebar said "Flavour" and meant nothing of the kind.
 *
 * One box, one hard-coded heading, and `getFilterFlavourOptions` poured every
 * variant option in the catalogue into it. On this shop it offered Regular,
 * Eggless, Round, Square and Heart — five ticks, not one of them a flavour. On a
 * shop selling chargers it would have offered 65W and Type-C. Nothing narrowed
 * the list to groups actually named Flavour, because by the time it reached the
 * panel nothing knew which group a label had come from: `toCard` flattened them.
 *
 * A box is a GROUP now, headed by the name the shop typed. This file is about
 * the two halves that decides: which boxes exist, and what a tick in one means.
 *
 * The second half is subtler than it looks, and this shop is the reason. Four of
 * its cakes are named "Eggless Chocolate Fudge", "Eggless Vanilla Dream",
 * "Eggless Fruit Fantasy" and "Eggless Red Velvet", and none of them carries an
 * "Egg preference" group at all — a migration removed it, because charging ₹80
 * to make an eggless cake eggless is not a choice. Match strictly on the group
 * and the shop's four actual eggless cakes vanish from the Eggless filter.
 */

const product = (over: Partial<LandingProduct>): LandingProduct =>
  ({
    id: over.slug ?? "p1",
    name: "Thing",
    slug: "thing",
    // Blank on a card by construction, which is why the fallback below reads the
    // NAME as well: on the page this runs, prose is not available to match on.
    description: "",
    price: 500,
    image: "",
    category: "Cakes",
    ...over,
  }) as LandingProduct;

const filters = (over: Partial<CollectionFilters>): CollectionFilters => ({
  ...DEFAULT_COLLECTION_FILTERS,
  ...over,
});

/** The live shelf, reduced to what decides the answers. */
const EGG = "Egg preference";
const CHOOSES = ["Vanilla Dream Cake", "Black Forest Supreme", "Red Velvet Classic"].map((name, i) =>
  product({
    slug: `chooses-${i}`,
    name,
    optionGroups: [
      { name: EGG, labels: ["Regular", "Eggless"] },
      { name: "Shape", labels: ["Round", "Square", "Heart"] },
    ],
  }),
);
const ALREADY_EGGLESS = [
  "Eggless Chocolate Fudge",
  "Eggless Vanilla Dream",
  "Eggless Fruit Fantasy",
  "Eggless Red Velvet",
].map((name, i) =>
  product({
    slug: `eggless-${i}`,
    name,
    // No Egg preference group. This is the shop's real data, not a contrivance.
    optionGroups: [{ name: "Shape", labels: ["Round", "Square", "Heart"] }],
  }),
);
const SHELF = [...CHOOSES, ...ALREADY_EGGLESS];

const kept = (over: Partial<CollectionFilters>, shelf: LandingProduct[] = SHELF) =>
  applyCollectionFilters(shelf, filters(over)).map((item) => item.slug);

describe("a product that does not answer the question is judged on its own words", () => {
  it("keeps the four cakes that are eggless without offering the choice", () => {
    /**
     * The single most important assertion in this file, and the one the old
     * tests could not make: they asserted `length > 0`, which the three cakes
     * that DO carry the group satisfy on their own.
     *
     * Named by slug, all four, because "some products survived" is exactly the
     * shape of a passing test over a broken filter.
     */
    const shown = kept({ options: { [optionFacetKey(EGG)]: ["Eggless"] } });

    for (const cake of ALREADY_EGGLESS) {
      expect(shown, `${cake.name} was hidden from the Eggless filter`).toContain(cake.slug);
    }
    expect(shown).toHaveLength(SHELF.length);
  });

  it("drops those same four from Regular, which they cannot be made", () => {
    // The mirror, and the reason a keep-everything fallback is wrong: it would
    // answer "show me the version with egg" with the four cakes that have none.
    const shown = kept({ options: { [optionFacetKey(EGG)]: ["Regular"] } });

    expect(shown).toEqual(CHOOSES.map((cake) => cake.slug));
  });

  it("reads the fallback as a word, not as a fragment", () => {
    /**
     * `haystack.includes(word)` kept an "all-round favourite" under Round and a
     * "Blackout Curtain Rod" under Black. The fallback exists to rescue a
     * product that states a fact in its name; it must not rescue one that
     * happens to contain the letters.
     */
    const shelf = [
      product({ slug: "cable", name: "USB Cable", optionGroups: [{ name: "Colour", labels: ["Black", "White"] }] }),
      product({ slug: "rod", name: "Blackout Curtain Rod" }),
      product({ slug: "shirt", name: "Irregular Fit Shirt" }),
      product({ slug: "tea", name: "Regular Breakfast Tea" }),
    ];

    expect(kept({ options: { colour: ["Black"] } }, shelf)).toEqual(["cable"]);
    expect(kept({ options: { grade: ["Regular"] } }, shelf)).toEqual(["tea"]);
  });

  it("finds a word the shop spelled with punctuation", () => {
    // "Type-C" and "65W" are labels a real shop types. Stripping punctuation
    // rather than requiring \w boundaries is what makes them findable.
    const shelf = [
      product({ slug: "charger", name: "65W Type-C Charger" }),
      product({ slug: "lamp", name: "Desk Lamp" }),
    ];

    expect(kept({ options: { connector: ["Type-C"] } }, shelf)).toEqual(["charger"]);
    expect(kept({ options: { wattage: ["65W"] } }, shelf)).toEqual(["charger"]);
  });

  it("does not fall back for a product that DID answer", () => {
    /**
     * The fallback is for silence, not for a second opinion. A cake sold only
     * in Square, whose name happens to say Round, is not a round cake.
     */
    const shelf = [
      product({
        slug: "allrounder",
        name: "All-Round Favourite",
        optionGroups: [{ name: "Shape", labels: ["Square"] }],
      }),
    ];

    expect(kept({ options: { shape: ["Round"] } }, shelf)).toEqual([]);
  });
});

describe("many boxes, one grid", () => {
  it("ANDs across boxes and ORs inside one", () => {
    // What a sidebar full of checkboxes reads as: "Heart or Square, AND Eggless".
    const shelf = [
      product({ slug: "heart", optionGroups: [{ name: "Shape", labels: ["Heart"] }, { name: EGG, labels: ["Eggless"] }] }),
      product({ slug: "square", optionGroups: [{ name: "Shape", labels: ["Square"] }, { name: EGG, labels: ["Regular"] }] }),
      product({ slug: "round", optionGroups: [{ name: "Shape", labels: ["Round"] }, { name: EGG, labels: ["Eggless"] }] }),
    ];

    expect(kept({ options: { shape: ["Heart", "Square"] } }, shelf)).toEqual(["heart", "square"]);
    expect(
      kept({ options: { shape: ["Heart", "Square"], [optionFacetKey(EGG)]: ["Eggless"] } }, shelf),
    ).toEqual(["heart"]);
  });

  it("ticks two boxes offering the same words independently", () => {
    /**
     * This shop has one product whose group is NAMED after itself — "Designer
     * Birthday Cakes", offering Regular and Eggless, beside an "Egg preference"
     * offering the same two. They are two questions, and no code rule may merge
     * them: on another trade, two boxes with identical options genuinely are.
     */
    const shelf = [
      product({ slug: "birthday", optionGroups: [{ name: "Designer Birthday Cakes", labels: ["Regular", "Eggless"] }] }),
      product({ slug: "plain", name: "Plain Cake", optionGroups: [{ name: EGG, labels: ["Regular", "Eggless"] }] }),
    ];

    expect(kept({ options: { "designer birthday cakes": ["Eggless"] } }, shelf)).toEqual(["birthday"]);
    expect(kept({ options: { [optionFacetKey(EGG)]: ["Eggless"] } }, shelf)).toEqual(["plain"]);
  });

  it("an empty tick list is not a filter", () => {
    // The panel deletes an emptied key, but a filters object assembled anywhere
    // else must not read `key: []` as "nothing matches".
    expect(kept({ options: { shape: [] } })).toHaveLength(SHELF.length);
    expect(kept({ options: {} })).toHaveLength(SHELF.length);
  });
});

describe("which boxes the shop is offered", () => {
  it("heads each box with the shop's own word, never one of ours", () => {
    const facets = getFilterOptionFacets(SHELF);

    // Shape is on all seven, Egg preference on three — the questions most of the
    // shop answers come first.
    expect(facets.map((facet) => facet.name)).toEqual(["Shape", EGG]);
    // Every shape is on every product here, so the count cannot order them and
    // the tie-break does: alphabetical, so the list does not depend on which
    // product happened to be added first. The count-first half is proved by
    // "is keyed by the name" below, where the counts differ.
    expect(facets[0].options).toEqual(["Heart", "Round", "Square"]);
  });

  it("does not name the trade, whatever the shop sells", () => {
    const facets = getFilterOptionFacets([
      product({ slug: "c", optionGroups: [{ name: "Wattage", labels: ["65W", "30W"] }] }),
      product({ slug: "p", optionGroups: [{ name: "Pot size", labels: ['6"', '8"'] }] }),
    ]);

    expect(facets.map((facet) => facet.name).sort()).toEqual(["Pot size", "Wattage"]);
  });

  it("is keyed by the name, so one question is one box across the shop", () => {
    /**
     * `createVariantGroup` mints a fresh id per product, so "Shape" carries a
     * different id on every one of this shop's 29 cakes. Keying on ids would
     * paint 29 boxes of three options each.
     */
    const facets = getFilterOptionFacets([
      product({ slug: "a", optionGroups: [{ name: "Shape", labels: ["Round"] }] }),
      product({ slug: "b", optionGroups: [{ name: "shape", labels: ["Heart"] }] }),
      product({ slug: "c", optionGroups: [{ name: "Shape ", labels: ["Round"] }] }),
    ]);

    expect(facets).toHaveLength(1);
    expect(facets[0].key).toBe("shape");
    // Commonest spelling wins the heading, so it does not depend on which
    // product was added first.
    expect(facets[0].name).toBe("Shape");
    expect(facets[0].options).toEqual(["Round", "Heart"]);
  });

  it("drops a box whose single answer every product gives", () => {
    // Every product Round: a tick that keeps the whole page, under a heading
    // spent on nothing.
    const facets = getFilterOptionFacets([
      product({ slug: "a", optionGroups: [{ name: "Shape", labels: ["Round"] }] }),
      product({ slug: "b", optionGroups: [{ name: "Shape", labels: ["Round"] }] }),
    ]);

    expect(facets).toEqual([]);
  });

  it("keeps a single-answer box that only some products carry", () => {
    /**
     * "Gift wrap: Yes" on three products out of four is a working filter, and a
     * bare "at least two options" rule would delete it. What makes a box useless
     * is one answer EVERYONE gives, which is the test above.
     */
    const shelf = [
      product({ slug: "a", optionGroups: [{ name: "Gift wrap", labels: ["Yes"] }] }),
      product({ slug: "b", name: "Plain" }),
    ];

    expect(getFilterOptionFacets(shelf).map((facet) => facet.name)).toEqual(["Gift wrap"]);
    expect(kept({ options: { "gift wrap": ["Yes"] } }, shelf)).toEqual(["a"]);
  });

  it("never offers a tick that empties the page it was built from", () => {
    /**
     * THE property, restated per box. The old version asserted it over one
     * flattened list; every box has to hold it separately, or a heading exists
     * whose every option clears the grid.
     */
    for (const facet of getFilterOptionFacets(SHELF)) {
      for (const option of facet.options) {
        expect(
          kept({ options: { [facet.key]: [option] } }).length,
          `${facet.name} → ${option} matched nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });
});

describe("the state a customer builds up", () => {
  it("counts one per box, the way every other axis here counts", () => {
    const ceiling = 5000;

    expect(countActiveFilters(defaultCollectionFilters(ceiling), ceiling)).toBe(0);
    expect(countActiveFilters(filters({ options: { shape: ["Round", "Heart"] } }), ceiling)).toBe(1);
    expect(
      countActiveFilters(filters({ options: { shape: ["Round"], egg: ["Eggless"] } }), ceiling),
    ).toBe(2);
    /**
     * `options` is a record. `.length` on it is `undefined`, `if (undefined)` is
     * false, and the badge would silently stop counting for ever — the mobile
     * sheet closing over three ticked boxes above a filtered grid, reading
     * plain "Filters".
     */
    expect(countActiveFilters(filters({ options: { shape: [] } }), ceiling)).toBe(0);
  });

  it("hands every caller its own record", () => {
    // The spread in `defaultCollectionFilters` is shallow, and fifteen files
    // spread the constant. One shared record and the first write reaches them all.
    expect(defaultCollectionFilters(1).options).not.toBe(defaultCollectionFilters(1).options);
    expect(Object.isFrozen(DEFAULT_COLLECTION_FILTERS.options)).toBe(true);
  });

  it("drops a tick the new page cannot show, and only then", () => {
    /**
     * A customer ticks "Wattage: 65W" on Chargers and clicks through to Plants.
     * No box shows it, and because a product that does not carry the group falls
     * back to its own words, the grid empties with nothing to explain why.
     */
    const carried = filters({ options: { wattage: ["65W"], shape: ["Round"] } });
    const onPlants = getFilterOptionFacets([
      product({ slug: "p", optionGroups: [{ name: "Shape", labels: ["Round", "Square"] }] }),
    ]);

    expect(pruneOptionSelections(carried, onPlants).options).toEqual({ shape: ["Round"] });
  });

  it("returns the very same object when there is nothing to drop", () => {
    /**
     * Identity, not equality, and it is load-bearing: the page runs
     * `useEffect(() => setPage(1), [categorySlug, filters])`, so a fresh object
     * per render sends a customer on page 3 back to page 1 on every keystroke.
     */
    const held = filters({ options: { shape: ["Round"] } });
    const offered = getFilterOptionFacets([
      product({ slug: "a", optionGroups: [{ name: "Shape", labels: ["Round", "Square"] }] }),
      product({ slug: "b", name: "Plain" }),
    ]);

    expect(pruneOptionSelections(held, offered)).toBe(held);
    // And on the first render, when nothing has been ticked at all.
    const untouched = filters({});
    expect(pruneOptionSelections(untouched, offered)).toBe(untouched);
  });
});

describe("the panel prints what it is handed", () => {
  const shown: Array<() => void> = [];
  afterEach(() => {
    while (shown.length) shown.pop()?.();
  });

  function draw(props: Record<string, unknown>) {
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(CollectionFiltersPanel, {
          filters: DEFAULT_COLLECTION_FILTERS,
          onChange: () => {},
          ...props,
        } as never),
      );
    });
    shown.push(() => {
      act(() => {
        root.unmount();
      });
      container.remove();
    });
    return container;
  }

  it("shows the shop's heading and the shop's answers", () => {
    const text =
      draw({ optionFacets: [{ key: "wattage", name: "Wattage", options: ["65W", "30W"] }] })
        .textContent ?? "";

    expect(text).toContain("Wattage");
    expect(text).toContain("65W");
  });

  it("names no question of its own when it is handed none", () => {
    /**
     * A shop with no variant groups and no legacy flavours gets no option boxes
     * at all — and, in particular, never the word this panel used to hard-code
     * over whatever it had.
     */
    const text = draw({ optionFacets: [], flavourOptions: [] }).textContent ?? "";

    expect(text).not.toContain("Flavour");
    // …and the axes that are not part of this change still print.
    expect(text).toContain("Occasion");
    expect(text).toContain("Size");
  });

  it("gives every checkbox its own id, in one panel and across two", () => {
    /**
     * Ids were built from the option LABEL. This shop carries "Regular" and
     * "Eggless" in two different groups, so the collision is inside one panel —
     * and Collections mounts the panel TWICE (a `hidden lg:block` sidebar that
     * is still in the document, plus the mobile sheet), so `<Label htmlFor>`
     * binds to whichever came first and a tap on the phone toggles a box
     * nobody can see.
     */
    const facets = [
      { key: "egg preference", name: EGG, options: ["Regular", "Eggless"] },
      { key: "designer birthday cakes", name: "Designer Birthday Cakes", options: ["Regular", "Eggless"] },
    ];
    const side = draw({ optionFacets: facets, idPrefix: "side-" });
    const sheet = draw({ optionFacets: facets, idPrefix: "sheet-" });

    const ids = [...side.querySelectorAll("[id]"), ...sheet.querySelectorAll("[id]")].map(
      (node) => node.id,
    );

    expect(ids.length).toBeGreaterThan(4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("leaves no dead key behind when the last tick in a box comes off", () => {
    /**
     * `options` carries a key only while something under it is ticked. An
     * emptied box left as `key: []` is a filter that reads as ON to anything
     * asking `key in options` — and the record is what the badge, the matcher
     * and the pruner all read.
     *
     * Harmless today, because all three ask for the array's length. This asserts
     * the invariant rather than the three current readers, since the fourth
     * reader is the one that will ask the other question.
     */
    let emitted: CollectionFilters | null = null;
    const container = draw({
      optionFacets: [{ key: "shape", name: "Shape", options: ["Round", "Heart"] }],
      filters: { ...DEFAULT_COLLECTION_FILTERS, options: { shape: ["Round"] } },
      onChange: (next: CollectionFilters) => {
        emitted = next;
      },
    });

    const box = container.querySelector("#opt-0-0");
    expect(box, "the ticked checkbox is not on the page").not.toBeNull();
    act(() => {
      box?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(emitted).not.toBeNull();
    expect(Object.keys((emitted as unknown as CollectionFilters).options)).toEqual([]);
  });

  it("keeps a long list short, but never hides something ticked", () => {
    /**
     * A colour list of twenty under a sidebar of eight boxes buries every other
     * question. Collapsing a TICKED option is worse: a filter the customer can
     * see no way to switch off.
     */
    const options = Array.from({ length: 12 }, (_, i) => `Colour ${i + 1}`);
    const text =
      draw({
        optionFacets: [{ key: "colour", name: "Colour", options }],
        filters: { ...DEFAULT_COLLECTION_FILTERS, options: { colour: ["Colour 12"] } },
      }).textContent ?? "";

    expect(text).toContain("Colour 1");
    expect(text).toContain("Colour 12");
    expect(text).not.toContain("Colour 11");
    expect(text).toContain("Show all 12");
  });

  it("does not let the flavour switch hide a question the shop asked", () => {
    /**
     * `modules.flavour` used to gate the one box that held every variant option
     * in the catalogue, so switching Flavour off in Settings took the SHAPE
     * filter down with it. It gates the legacy list and nothing else now.
     */
    const raw = readFileSync(
      join(process.cwd(), "components/storefront/collection-filters-panel.tsx"),
      "utf8",
    );
    /**
     * Comments stripped before slicing, or this reads its own tombstones: the
     * note above the legacy box says "the only thing `modules.flavour` gates
     * now" and sits between the two blocks, so the assertion below would fail on
     * the sentence explaining why it passes.
     */
    const panel = raw.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const facetBlock = panel.slice(
      panel.indexOf("{optionFacets.map("),
      panel.indexOf("{modules.flavour"),
    );

    expect(facetBlock.length).toBeGreaterThan(200);
    expect(facetBlock).not.toContain("modules.");
    expect(facetBlock).not.toContain("data-gate-");
    // The legacy box keeps the gate, and hides itself rather than printing a
    // heading over nothing.
    expect(panel).toContain("{modules.flavour && flavours.length > 0 ? (");
    expect(panel.split("data-gate-flavour").length - 1).toBe(1);
  });
});

describe("both panels are wired, and to the category being shown", () => {
  const page = readFileSync(
    join(process.cwd(), "apps/website/pages/collections-page.tsx"),
    "utf8",
  );

  it("hands the boxes to the sidebar and to the sheet", () => {
    // Wiring only the first is invisible on a laptop and leaves every phone
    // without the filters.
    expect(page.split("optionFacets={optionFacets}").length - 1).toBe(2);
    expect(page.split('idPrefix="').length - 1).toBe(2);
  });

  it("builds them from the category on screen, not the whole shop", () => {
    /**
     * Over the whole catalogue, a Plants page would head a box "Wattage" that
     * nothing on it answers — and every tick of it would empty the grid through
     * the name fallback. `inCategory` moves with the route and not with a tick,
     * so the boxes do not vanish as the customer uses them.
     */
    expect(page).toContain("getFilterOptionFacets(inCategory)");
    expect(page).not.toContain("getFilterOptionFacets(catalog)");
  });

  it("filters and counts on the ticks this page can show", () => {
    /**
     * The pruning is DERIVED, not written back into state — writing back would
     * be a setState inside an effect, a cascading render on every category
     * change, and it would forget a tick the customer could walk back to. So the
     * grid, the badge and both panels all have to read the derived value; one of
     * them left on the raw state is a badge counting a filter that is not
     * applied, or a panel showing a tick the grid ignores.
     */
    expect(page).toContain("pruneOptionSelections(filters, optionFacets)");
    expect(page).toContain("applyCollectionFilters(inCategory, shownFilters)");
    expect(page).toContain("countActiveFilters(shownFilters, priceCeiling)");
    expect(page.split("filters={shownFilters}").length - 1).toBe(2);
  });
});

describe("the card carries the grouping, and the flat list comes from it", () => {
  it("keeps search and the sidebar reading the same words", async () => {
    /**
     * Gathering the flat list separately is how "tick Heart in the sidebar, type
     * Heart in search" comes apart later — silently, because both halves still
     * return results. Asserted on a real card rather than on source text.
     */
    vi.resetModules();
    vi.doMock("@/features/products/server/product.repository", () => ({
      listAll: vi.fn(async () => [
        {
          id: "p1",
          name: "Vanilla Dream Cake",
          slug: "vanilla-dream",
          price: 800,
          images: ["/v.jpg"],
          status: "published",
          stockStatus: "in_stock",
          flavourOptions: [],
          shapes: [],
          descriptionBlocks: [],
          weights: [{ label: "1 kg", price: 800 }],
          variantGroups: [
            {
              id: "g-shape",
              name: "Shape",
              type: "shape",
              options: [
                { id: "o-round", label: "Round", priceAdjustment: 0, isDefault: true },
                { id: "o-heart", label: "Heart", priceAdjustment: 200 },
              ],
            },
          ],
        },
      ]),
    }));
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: vi.fn(async () => ({ modules: { shape: true } })),
      getPublicSettings: vi.fn(async () => ({})),
    }));

    const { getStorefrontProductCards } = await import(
      "@/features/products/data/products-service"
    );
    const [card] = await getStorefrontProductCards();

    expect(card.optionGroups).toEqual([{ name: "Shape", labels: ["Round", "Heart"] }]);
    expect(card.optionLabels).toEqual(
      (card.optionGroups ?? []).flatMap((group) => group.labels),
    );
    // The groups themselves still do not travel — the payload is budgeted for
    // 5,000 products, and this is a name and two words.
    expect(card.variantGroups).toBeUndefined();

    // The sidebar's word finds the product in search too.
    expect(searchProducts("Heart", [card]).map((item) => item.slug)).toEqual(["vanilla-dream"]);
    expect(getFilterOptionFacets([card, product({ slug: "other" })])[0].name).toBe("Shape");

    vi.doUnmock("@/features/products/server/product.repository");
    vi.doUnmock("@/features/settings/server/settings.service");
    vi.resetModules();
  });

  it("builds no box for a module the shop switched off", async () => {
    /**
     * The gate is applied server-side, inside `toCard`, so a Shape box is never
     * BUILT rather than hidden. That also means the panel's localStorage copy of
     * `modules` cannot overrule what the database said.
     */
    vi.resetModules();
    vi.doMock("@/features/products/server/product.repository", () => ({
      listAll: vi.fn(async () => [
        {
          id: "p1",
          name: "Vanilla Dream Cake",
          slug: "vanilla-dream",
          price: 800,
          images: ["/v.jpg"],
          status: "published",
          stockStatus: "in_stock",
          flavourOptions: [],
          shapes: [],
          descriptionBlocks: [],
          weights: [{ label: "1 kg", price: 800 }],
          variantGroups: [
            {
              id: "g-shape",
              name: "Shape",
              type: "shape",
              options: [
                { id: "o-round", label: "Round", priceAdjustment: 0, isDefault: true },
                { id: "o-heart", label: "Heart", priceAdjustment: 200 },
              ],
            },
          ],
        },
      ]),
    }));
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: vi.fn(async () => ({ modules: { shape: false } })),
      getPublicSettings: vi.fn(async () => ({})),
    }));

    const { getStorefrontProductCards } = await import(
      "@/features/products/data/products-service"
    );
    const [card] = await getStorefrontProductCards();

    expect(card.optionGroups).toEqual([]);
    expect(card.optionLabels).toEqual([]);
    expect(getFilterOptionFacets([card])).toEqual([]);

    vi.doUnmock("@/features/products/server/product.repository");
    vi.doUnmock("@/features/settings/server/settings.service");
    vi.resetModules();
  });
});
