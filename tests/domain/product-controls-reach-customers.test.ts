import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// The catalog helpers read localStorage; give them a fixed taxonomy so the
// weight re-derivation can be exercised as arithmetic rather than as a mock.
vi.mock("@/features/catalog/lib/catalog-repository", () => ({
  getCategories: () => [],
  getOccasions: () => [],
  getCategoryById: () => undefined,
  getCategoryByName: () => undefined,
  getWeightOptions: () => [
    { id: "w1", label: "0.5 kg", modifier: 0, serves: "2-4", sortOrder: 1 },
    { id: "w2", label: "1 kg", modifier: 400, serves: "6-8", sortOrder: 2 },
    { id: "w3", label: "2 kg", modifier: 900, serves: "12-16", sortOrder: 3 },
  ],
}));

import { rederiveWeights } from "@/features/products/lib/catalog-options";
import {
  applyCollectionFilters,
  getFilterWeightOptions,
  DEFAULT_COLLECTION_FILTERS,
} from "@/apps/website/lib/collection-filters";
import type { LandingProduct } from "@/constants/landing-data";

const root = process.cwd();
const read = (relative: string) => readFileSync(path.join(root, relative), "utf8");

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

/**
 * A cake page's <title> could not depend on the cake.
 *
 * The route exported a static `metadata` object, which cannot read the route
 * params, so every product in the shop shipped "Cake Details | <shop>" and the
 * same description. The SEO tab, its Google-result preview card and the stored
 * `seo.metaTitle` all existed; nothing in app/ read any of them.
 */
describe("each cake ships its own metadata", () => {
  const source = read("app/(storefront)/store/cakes/[slug]/page.tsx");
  const code = stripComments(source);

  it("generates metadata per route instead of exporting a fixed object", () => {
    expect(code).toContain("export async function generateMetadata");
    expect(code).not.toMatch(/export const metadata\s*[:=]/);
    expect(code).not.toContain('title: "Cake Details"');
  });

  it("reads the admin's SEO fields, from the full product", () => {
    // The storefront projection carries neither `seo` nor `shortDescription`.
    expect(code).toContain("getProductBySlug(slug)");
    expect(code).toContain("cake.seo?.metaTitle");
    expect(code).toContain("cake.seo?.metaDescription");
  });

  it("falls back to the cake's own name and copy", () => {
    // A shop that never opens the SEO tab must still get distinct pages.
    expect(code).toMatch(/typed \|\| cake\.name/);
    expect(code).toContain("cake.description?.trim()");
    /**
     * `shortDescription` was the middle step of three, and it was a second
     * box for the first step's job: nothing on the storefront rendered it,
     * and the SEO tab already has a meta description field. Two steps now.
     */
    expect(code).not.toContain("shortDescription");
  });

  it("cannot be stored either, so nothing can put it back by writing one", async () => {
    /**
     * The gate a removed field has to pass as surely as a new one. Left as a
     * Mongoose path, an import or an old client could go on writing a value
     * that no screen shows and no read uses — dead weight in every product
     * document, and a field somebody would eventually wire back up.
     */
    const { ProductModel } = await import("@/lib/server/db/models/product.model");
    const doc = new ProductModel({
      _id: "p-x",
      name: "Black Forest",
      slug: "black-forest",
      shortDescription: "One line for Google",
      description: "Cherries and cream.",
    });

    const stored = doc.toObject() as { shortDescription?: string; description?: string };

    expect(stored.shortDescription).toBeUndefined();
    expect(stored.description).toBe("Cherries and cream.");
  });

  it("does not publish metadata for an unpublished cake", () => {
    expect(code).toMatch(/cake\.status !== "published"/);
  });

  it("does not repeat the shop name when the admin already wrote it", () => {
    // The root layout appends "| <shop>"; every product here already carries a
    // brand suffix the old form appended, so the title read
    // "Black Forest Supreme | Acme | Acme".
    expect(code).toContain("alreadyBranded");
    expect(code).toMatch(/endsWith\(siteName/);
    expect(code).toMatch(/absolute: typed/);
  });
});

/**
 * Two form fields that quietly destroyed what the admin typed.
 */
describe("the product form keeps what was typed", () => {
  const form = stripComments(read("apps/admin/products/components/product-form-page.tsx"));

  it("does not copy the name into the meta title at all", () => {
    /**
     * Two versions of one mistake. First the title was derived with `||`, so the
     * first keystroke made it truthy and froze it at "R". Then it tracked the
     * name while ADDING and stopped in edit mode — so every product shipped with
     * a stored title, and a later rename left it behind: a cake renamed "Belgian
     * Truffle" went on telling Google "Chocolate Cake", with nothing on screen
     * to say why.
     *
     * Nothing writes it now. The box is blank and shows the name as a
     * placeholder, and the route falls back to `cake.name` when it is blank — so
     * it follows a rename for ever unless somebody types something else.
     */
    expect(form).not.toContain("metaTitleTouched");
    expect(form).toContain("placeholder={form.name ||");
  });

  it("no longer stamps a hard-coded brand into tenant data", () => {
    expect(form).not.toContain("| Monginis");
  });

  it("re-prices weights instead of replacing them", () => {
    expect(form).toContain("rederiveWeights(prev.weights, price, prev.price)");
    expect(form).not.toContain("weights: getDefaultWeights(price)");
  });

  it("no longer offers a short description at all", () => {
    /**
     * Its placeholder promised "One-line summary for cards" and no card
     * rendered it; the hint was then corrected to say it fed the search
     * result. Both were papering over the real problem — the SEO tab has a
     * meta description of its own, so this was a second box for one job,
     * named as though customers would read it, in the tab about what a
     * product IS. Three things called a description on one form.
     */
    const code = stripComments(form);

    expect(code).not.toContain("shortDescription");
    expect(code).not.toContain("Short description");
    // …and the paragraph that IS real moved to the tab it prints in.
    // Renamed once the render order was checked: the blocks print as bullets
    // first and this prints as prose AFTER them.
    expect(code).toContain("Closing paragraph");
  });
});

describe("changing the base price", () => {
  // Derived from a 1000 base: 1000 / 1400 / 1900.
  const derived = [
    { label: "0.5 kg", price: 1000, serves: "2-4" },
    { label: "1 kg", price: 1400, serves: "6-8" },
    { label: "2 kg", price: 1900, serves: "12-16" },
  ];

  it("re-prices tiers the admin never touched", () => {
    const next = rederiveWeights(derived, 1200, 1000);
    expect(next.map((tier) => tier.price)).toEqual([1200, 1600, 2100]);
  });

  it("moves a tier the admin priced by hand by the same amount", () => {
    // The old rule pinned it, by comparing against the shop-wide Catalog
    // presets. Sizes are typed on the product now and there is nothing to
    // compare against — so every size keeps its distance from the base.
    const handEdited = [...derived];
    handEdited[2] = { ...handEdited[2], price: 2500 };

    const next = rederiveWeights(handEdited, 1200, 1000);

    expect(next.map((tier) => tier.price)).toEqual([1200, 1600, 2700]);
  });

  it("matches tiers by label, so a catalog change does not shift the comparison", () => {
    // Re-priced by NAME, not by position: a preset added or removed in the
    // catalog must not slide the comparison onto the wrong tier.
    const reordered = [derived[2], derived[0], derived[1]];
    const next = rederiveWeights(reordered, 1000, 1000);
    expect(next).toEqual(reordered);
  });

  it("does NOT add a size the product is not sold in", () => {
    /**
     * This used to map over every catalog preset, so a product sold in one
     * size grew back to all of them on the first keystroke in the Price field.
     * Removing a size could not stick — correcting a typo in the base price
     * put it back, priced and orderable, with nothing to say it had.
     *
     * Which sizes a product comes in is the PRODUCT's answer. What each one
     * costs, when the shop has not said otherwise, is the catalog's.
     */
    const next = rederiveWeights([derived[0]], 1000, 1000);

    expect(next.map((tier) => tier.label)).toEqual(["0.5 kg"]);
  });

  it("treats a size the shop has never used elsewhere like any other", () => {
    // Nothing is looked up any more, so there is no such thing as a size the
    // system does not recognise.
    const retired = { label: "5 kg", price: 4000, serves: "30+" };

    const next = rederiveWeights([derived[0], retired], 1200, 1000);

    expect(next[0].price).toBe(1200);
    expect(next[1].price).toBe(4200);
  });
});

/** The storefront filters described one thing and did another. */
describe("collection filters use the product's real data", () => {
  const cake = (over: Partial<LandingProduct>): LandingProduct =>
    ({
      id: "1", name: "Plain Cake", slug: "plain", description: "A cake.",
      price: 500, image: "", category: "Cakes",
      ...over,
    }) as LandingProduct;

  it("matches the weight tiers a cake is actually sold in", () => {
    // The old rule was a price band: "1.5 kg" meant "costs at least 1400".
    const small = cake({ slug: "small", price: 5000, weights: [{ label: "0.5 kg", price: 5000 }] });
    const large = cake({ slug: "large", price: 300, weights: [{ label: "2 kg", price: 300 }] });

    const result = applyCollectionFilters([small, large], {
      ...DEFAULT_COLLECTION_FILTERS,
      weights: ["2 kg"],
    });

    // An expensive small cake used to pass and a cheap large one used to fail.
    expect(result.map((item) => item.slug)).toEqual(["large"]);
  });

  it("offers a tier the shop added, which the hard-coded list could not", () => {
    const twoKg = cake({ slug: "two", weights: [{ label: "2 kg", price: 900 }] });
    const result = applyCollectionFilters([twoKg], {
      ...DEFAULT_COLLECTION_FILTERS,
      weights: ["2 kg"],
    });
    expect(result).toHaveLength(1);
  });

  it("matches the occasions a cake is tagged with", () => {
    const tagged = cake({ slug: "tagged", occasions: ["Wedding"], description: "A cake." });
    const mentions = cake({
      slug: "mentions",
      occasions: ["Birthday"],
      description: "Perfect for the day after a wedding.",
    });

    const result = applyCollectionFilters([tagged, mentions], {
      ...DEFAULT_COLLECTION_FILTERS,
      occasions: ["Wedding"],
    });

    // The old rule searched the prose: it missed `tagged` unless the text said
    // so, and included `mentions` because the word appears.
    expect(result.map((item) => item.slug)).toEqual(["tagged"]);
  });

  it("still finds untagged products by text, so the demo catalogue works", () => {
    const untagged = cake({ slug: "legacy", description: "A classic wedding cake." });
    const result = applyCollectionFilters([untagged], {
      ...DEFAULT_COLLECTION_FILTERS,
      occasions: ["Wedding"],
    });
    expect(result).toHaveLength(1);
  });

  it("does not hide a single-size cake the moment the weight filter is used", () => {
    const noTiers = cake({ slug: "one-size" });
    const result = applyCollectionFilters([noTiers], {
      ...DEFAULT_COLLECTION_FILTERS,
      weights: ["1 kg"],
    });
    expect(result).toHaveLength(1);
  });

  it("the card projection carries what the filters filter on", () => {
    // The collections page filters the CARD projection on the client, and the
    // fields these filters read were not in it — so the occasion filter fell
    // back to searching prose, "Eggless only" fell back to matching the category
    // NAME, and the weight filter matched everything because no card carried a
    // tier to match against. Fixing the filters reached nobody without this.
    const source = stripComments(read("features/products/data/products-service.ts"));
    const start = source.indexOf("function toCard(");
    const fn = source.slice(start, source.indexOf("\n}", start));

    for (const field of ["occasions", "flavours", "weights"]) {
      expect(fn, `toCard must carry ${field} or the filter that reads it is dead`).toContain(
        `${field}: product.${field}`,
      );
    }

    // Still a projection, not the whole product — that is the point of it.
    expect(fn).not.toContain("...product");
    expect(fn).toContain('description: ""');
  });

  it("offers the sizes the products on the page are actually sold in", () => {
    /**
     * Three answers, in order. It was the hard-coded list, so a shop that
     * renamed a tier had a panel offering sizes it does not sell. Then it was
     * the shop-wide Catalog taxonomy — better, but still a second list to keep
     * in step: a size could sit in Catalog with nothing using it, and a product
     * could be sold in a size Catalog had never heard of.
     *
     * Now it is read off the products, which is the only definition that cannot
     * go stale — and it is the same set `matchesWeight` compares against, so a
     * tick can no longer match nothing.
     */
    const options = getFilterWeightOptions([
      cake({ slug: "a", weights: [{ label: "1 kg", price: 900 }] }),
      cake({
        slug: "b",
        weights: [{ label: "1 kg", price: 800 }, { label: "500 gm", price: 500 }],
      }),
    ]);

    // Commonest first, so the sizes a shop mostly sells lead.
    expect(options).toEqual(["1 kg", "500 gm"]);
  });

  it("offers nothing when nothing on the page is sold by size", () => {
    // A shop selling phone chargers gets no size filter at all, rather than
    // three bakery labels that would hide its whole catalogue when ticked.
    expect(getFilterWeightOptions([cake({ slug: "charger" })])).toEqual([]);
  });

  it("ignores a size row left without a name", () => {
    expect(
      getFilterWeightOptions([
        cake({ slug: "a", weights: [{ label: "  ", price: 100 }, { label: "1 kg", price: 900 }] }),
      ]),
    ).toEqual(["1 kg"]);
  });
});
