import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildHomepageProducts } from "@/features/products/lib/homepage-rails";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";
import type { Product } from "@/types/product";

/**
 * The homepage was a row shorter than the shop had configured, and said nothing
 * about it.
 *
 * Removing the egg special case took the `eggless` section type with it — out of
 * the union, out of the registry and out of the renderer's switch, which falls
 * through to `default: return null`. The shop's stored layout still carries the
 * row, in draft and published, visible, titled "Eggless Collection". So it
 * rendered as literally nothing: no crash, no empty band, no trace. The admin
 * builder showed an orphan row labelled "eggless" and "This section type is no
 * longer available", which nobody looks at unless something is already wrong.
 *
 * The row is back, and it reads the CATEGORY — the same source the nav's
 * "Eggless Cakes" link and /collections/eggless already use, so the row and the
 * page it links to cannot disagree. What is gone is the flag it used to select
 * on: `isEggless` was a claim about a RECIPE derived from an option label, and
 * a recipe is the shop's to state.
 *
 * TWO THINGS HAD TO BE RIGHT FOR IT TO WORK AT ALL.
 *
 * The slug. `filterProductsByCategory` falls back to slugifying the product's
 * category NAME, which only works where a shop has not renamed a category away
 * from its slug — and this shop has "Eggless Cakes" at /eggless, so the fallback
 * compares "eggless-cakes" with "eggless" and the row comes back empty. The
 * shop's own category list has to reach the matcher. Seasonal, shipped a
 * fortnight earlier, worked only because its name happens to equal its slug.
 *
 * And the padding. `buildHomepageProducts` tops a short row up from the wider
 * catalogue so a grid never shows a lone card, which is a fair display decision
 * for a row the shop CURATES. Under the overline "100% Eggless" it is a false
 * statement about food — the original removal note called this out by name as
 * the reason the rail could not simply be left alone. A row that says what its
 * products ARE is not padded.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * The same file with its comments taken out.
 *
 * Every removal here leaves a tombstone naming what went — including the one
 * directly above the entry this checks — so an unstripped search for the
 * removed wording matches the EXPLANATION and the guard passes for the thing it
 * forbids.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/** The shop's real taxonomy: the name and the slug genuinely differ. */
const CATEGORIES = [
  { name: "Eggless Cakes", slug: "eggless" },
  // Renamed away from its slug too, deliberately: the live shop happens to call
  // this one "Seasonal", so a fixture that copied it would let the seasonal row
  // pass on the slugify fallback and never notice the list had stopped arriving.
  { name: "Seasonal Specials", slug: "seasonal" },
  { name: "Birthday Cakes", slug: "birthday" },
];

const names = {
  categories: new Map([
    ["cat-eggless", "Eggless Cakes"],
    ["cat-seasonal", "Seasonal Specials"],
    ["cat-birthday", "Birthday Cakes"],
  ]),
};

const product = (slug: string, categoryId: string): Product =>
  ({
    id: slug,
    name: slug,
    slug,
    description: "",
    price: 999,
    images: ["/cake.jpg"],
    categoryId,
    occasionIds: [],
    weights: [],
    shapes: [],
    flavourOptions: [],
    variantGroups: [],
    attributes: [],
    allowsMessage: true,
    allowsPhotoUpload: false,
    status: "published",
  }) as unknown as Product;

const fudge = product("eggless-chocolate-fudge", "cat-eggless");
const vanilla = product("eggless-vanilla-dream", "cat-eggless");
const truffle = product("chocolate-truffle", "cat-birthday");
const forest = product("black-forest", "cat-birthday");

/**
 * The wider pool the top-up draws from — the shop's whole published catalogue,
 * exactly as `getHomepageRails` builds it. Passing `[]` here would leave every
 * padding assertion below unable to fail.
 */
const pool = (shop: Product[]) => getPublishedStorefrontProducts(shop, names);

describe("the eggless row", () => {
  const shop = [fudge, vanilla, truffle, forest];

  it("holds the cakes the shop filed under Eggless", () => {
    const row = buildHomepageProducts("eggless", 4, shop, pool(shop), names, CATEGORIES);

    expect(row.map((cake) => cake.slug)).toEqual([
      "eggless-chocolate-fudge",
      "eggless-vanilla-dream",
    ]);
  });

  it("finds them even though the category is not named after its slug", () => {
    /**
     * The whole reason the category list has to be passed. Without it the
     * matcher slugifies "Eggless Cakes" to "eggless-cakes", compares that with
     * "eggless", and the shop's row is empty on a page that renders no error.
     */
    const withoutTheList = buildHomepageProducts("eggless", 4, shop, [], names);

    expect(withoutTheList).toEqual([]);
    expect(
      buildHomepageProducts("eggless", 4, shop, pool(shop), names, CATEGORIES),
    ).toHaveLength(2);
  });

  it("finds them from the shop's own products with no wider pool at all", () => {
    /**
     * `all` empty, so the row can only come from the admin products. The
     * matcher filters the two pools separately and `mergeWithCatalog` falls
     * back to the second when the first is empty — which means a category list
     * that reaches only ONE of them still looks correct wherever the two pools
     * hold the same cakes, and both live callers pass pools that do.
     */
    const row = buildHomepageProducts("eggless", 4, shop, [], names, CATEGORIES);

    expect(row.map((cake) => cake.slug)).toEqual([
      "eggless-chocolate-fudge",
      "eggless-vanilla-dream",
    ]);
  });

  it("shows two cakes rather than padding to four with cakes that have eggs", () => {
    /**
     * There ARE two more cakes in the pool, and every curated row would take
     * them to fill the grid. This one must not: the heading above it is a
     * statement about what is in the cake.
     */
    const row = buildHomepageProducts("eggless", 4, shop, pool(shop), names, CATEGORIES);

    expect(row).toHaveLength(2);
    expect(row.map((cake) => cake.slug)).not.toContain("chocolate-truffle");
    expect(row.map((cake) => cake.slug)).not.toContain("black-forest");
  });

  it("still respects the shop's own maximum", () => {
    expect(
      buildHomepageProducts("eggless", 1, shop, pool(shop), names, CATEGORIES),
    ).toHaveLength(1);
  });
});

describe("the rows beside it", () => {
  it("stop padding a seasonal row with cakes that are not seasonal", () => {
    const shop = [product("winter-log", "cat-seasonal"), truffle, forest];
    const row = buildHomepageProducts("seasonal", 4, shop, pool(shop), names, CATEGORIES);

    expect(row.map((cake) => cake.slug)).toEqual(["winter-log"]);
  });

  it("resolve the seasonal slug through the list as well", () => {
    // Same trap, same fix: this shop calls the category "Seasonal Specials".
    const shop = [product("winter-log", "cat-seasonal"), truffle];

    expect(buildHomepageProducts("seasonal", 4, shop, [], names, CATEGORIES)).toHaveLength(1);
    expect(buildHomepageProducts("seasonal", 4, shop, [], names)).toEqual([]);
  });

  it("stop padding a photo row with products that take no photograph", () => {
    const printable = {
      ...product("photo-cake", "cat-birthday"),
      allowsPhotoUpload: true,
    } as Product;
    const shop = [printable, truffle, forest];

    const row = buildHomepageProducts("photo-cakes", 4, shop, pool(shop), names, CATEGORIES);

    expect(row.map((cake) => cake.slug)).toEqual(["photo-cake"]);
  });

  it("go on padding a row the shop merely curates", () => {
    /**
     * Featured, Trending and Best Sellers are the shop's own selection, and a
     * fourth cake beside one chosen one says nothing untrue about any of them.
     * Only the claims are exempt — which is what makes this a rule rather than
     * a switch that turns the feature off.
     */
    const featured = { ...truffle, isFeatured: true } as Product;
    const shop = [featured, forest, fudge, vanilla];

    const row = buildHomepageProducts("featured", 4, shop, pool(shop), names, CATEGORIES);

    expect(row).toHaveLength(4);
    expect(row[0]?.slug).toBe("chocolate-truffle");
  });
});

describe("the section the shop already has stored", () => {
  it("is a type the renderer knows again", () => {
    // Comment-stripped, like the sibling below: this repo leaves a tombstone
    // naming what it removed at every such site, and the removal commit added
    // fifteen of them — so a raw search can be satisfied by the explanation.
    expect(code("types/homepage-builder.ts")).toContain('| "eggless"');
    expect(code("features/cms-sections/homepage-section-renderer.tsx")).toContain(
      'case "eggless":',
    );
  });

  it("is offered in the builder, so it can be edited or removed", () => {
    expect(code("constants/section-registry.ts")).toContain('type: "eggless"');
  });

  it("is one of the rails the server actually builds, with the list it needs", () => {
    /**
     * A row the renderer can draw and the server never fills is the same blank
     * band by another route: `getHomepageRails` returns a record keyed by
     * source, and the renderer reads `props.rails?.[source]`.
     */
    const service = code("features/products/data/products-service.ts");
    // Bounded at the function's closing brace, not run to EOF — this is the
    // last export in the file today, and a slice that relies on that stops
    // meaning "inside getHomepageRails" the moment somebody appends one.
    const start = service.indexOf("export async function getHomepageRails");
    const rails = service.slice(start, service.indexOf("\n}", start));

    expect(rails.length).toBeGreaterThan(200);
    expect(rails).toContain('"eggless"');
    expect(rails).toContain("categorySlugs()");
    expect(rails).toContain("buildHomepageProducts(source, maxCount, products, all, names, categories)");
  });

  it("tells the admin to file a product, not to set a flag that is gone", () => {
    /**
     * An empty row renders nothing on the live site and an explanation in the
     * builder. That explanation said "Flag some cakes under Products" for every
     * row — and for this one and Seasonal there is no flag any more, so an
     * admin could hunt for a tick that does not exist and conclude the builder
     * was broken.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");

    expect(renderer).toContain('const CATEGORY_ROWS: ReadonlySet<string> = new Set(["eggless", "seasonal"])');
    expect(renderer).toContain("CATEGORY_ROWS.has(props.section.type)");
    expect(renderer).toContain("Nothing is filed under this category yet");
    // …and the flag wording survives for the rows that DO have one.
    expect(renderer).toContain("Flag some cakes under Products");
  });

  it("ships no promise about what is in the cake", () => {
    /**
     * The entry used to default to the overline "100% Eggless" and a
     * description asserting every cake was crafted without eggs — a guarantee
     * about food, made by the software, on every install. The title names the
     * category and the shop writes the rest.
     */
    const registry = code("constants/section-registry.ts");
    const entry = registry.slice(
      registry.indexOf('type: "eggless"'),
      registry.indexOf('type: "seasonal"'),
    );

    expect(entry).toContain('title: "Eggless Collection"');
    // The invariant is that both loud fields ship EMPTY. Forbidding the two
    // sentences that used to be there only rules out those two sentences.
    expect(entry).toContain('overline: ""');
    expect(entry).toContain('description: ""');
    expect(entry).not.toContain("100% Eggless");
    expect(entry).not.toContain("without eggs for all celebrations");
  });
});
