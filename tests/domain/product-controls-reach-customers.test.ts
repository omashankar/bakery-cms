import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

// The catalog helpers read localStorage; give them a fixed taxonomy so the
// weight re-derivation can be exercised as arithmetic rather than as a mock.
vi.mock("@/features/catalog/lib/catalog-repository", () => ({
  getCategories: () => [],
  getFlavours: () => [],
  getOccasions: () => [],
  getCategoryById: () => undefined,
  getCategoryByName: () => undefined,
  getFlavourByName: () => undefined,
  getWeightOptions: () => [
    { id: "w1", label: "0.5 kg", modifier: 0, serves: "2-4", sortOrder: 1 },
    { id: "w2", label: "1 kg", modifier: 400, serves: "6-8", sortOrder: 2 },
    { id: "w3", label: "2 kg", modifier: 900, serves: "12-16", sortOrder: 3 },
  ],
}));

import { rederiveWeights } from "@/features/products/lib/catalog-options";
import { applyCollectionFilters, DEFAULT_COLLECTION_FILTERS } from "@/apps/website/lib/collection-filters";
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
    expect(code).toContain("cake.shortDescription?.trim()");
    expect(code).toContain("cake.description?.trim()");
  });

  it("does not publish metadata for an unpublished cake", () => {
    expect(code).toMatch(/cake\.status !== "published"/);
  });

  it("does not repeat the shop name when the admin already wrote it", () => {
    // The root layout appends "| <shop>"; every product here already carries a
    // "| Monginis" the old form appended, so the title read
    // "Black Forest Supreme | Monginis | Monginis".
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

  it("stops deriving the meta title once the admin edits it", () => {
    // It was `prev.seo.metaTitle || `${name} | Monginis``, so the FIRST keystroke
    // made it truthy and it froze there: "Rose Truffle Delight" left it as "R".
    expect(form).toContain("metaTitle: metaTitleTouched ? prev.seo.metaTitle : name");
    expect(form).toContain("setMetaTitleTouched(true)");
  });

  it("no longer stamps a hard-coded brand into tenant data", () => {
    expect(form).not.toContain("| Monginis");
  });

  it("re-prices weights instead of replacing them", () => {
    expect(form).toContain("rederiveWeights(prev.weights, price, prev.price)");
    expect(form).not.toContain("weights: getDefaultWeights(price)");
  });

  it("describes the short description by what it actually does", () => {
    // The placeholder promised "One-line summary for cards" and no card rendered
    // it. It is now the search-result description when the SEO tab is blank.
    expect(form).not.toContain("One-line summary for cards");
    expect(form).toContain("Used as the search-result description when the SEO tab is empty.");
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

  it("keeps a tier the admin priced by hand", () => {
    // The whole point: editing the base by one rupee used to discard this.
    const handEdited = [...derived];
    handEdited[2] = { ...handEdited[2], price: 2500 };

    const next = rederiveWeights(handEdited, 1200, 1000);
    expect(next[0].price).toBe(1200);
    expect(next[1].price).toBe(1600);
    expect(next[2].price).toBe(2500);
  });

  it("matches tiers by label, so a catalog change does not shift the comparison", () => {
    const reordered = [derived[2], derived[0], derived[1]];
    const next = rederiveWeights(reordered, 1000, 1000);
    expect(next).toEqual(derived);
  });

  it("adds a tier the catalog has but the product does not", () => {
    const next = rederiveWeights([derived[0]], 1000, 1000);
    expect(next.map((tier) => tier.label)).toEqual(["0.5 kg", "1 kg", "2 kg"]);
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

    for (const field of ["occasions", "isEggless", "flavours", "weights"]) {
      expect(fn, `toCard must carry ${field} or the filter that reads it is dead`).toContain(
        `${field}: product.${field}`,
      );
    }

    // Still a projection, not the whole product — that is the point of it.
    expect(fn).not.toContain("...product");
    expect(fn).toContain('description: ""');
  });

  it("offers the shop's own weight labels, not three hard-coded ones", () => {
    const source = stripComments(read("apps/website/lib/collection-filters.ts"));
    expect(source).toContain("getWeightOptions().map((option) => option.label)");
    expect(source).not.toContain('return ["0.5 kg", "1 kg", "1.5 kg"]');
    // And the price bands are gone.
    expect(source).not.toContain("cake.price >= 1400");
  });
});
