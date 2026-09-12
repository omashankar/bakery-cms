/**
 * A COLLECTION IS A LIST SOMEBODY WROTE, NOT A RULE THAT MATCHES.
 *
 * A category says what a thing IS — Cakes, Plants — and a product joins one
 * from its own form. A collection says why you would buy it NOW — Diwali
 * Gifts, Under ₹500 — and the shop fills it from the collection's own side,
 * because nobody is opening forty product forms to build one row.
 *
 * That difference is the whole test. Everything else on this page already
 * existed: the grid, the filters, the pagination, the route, the write
 * plumbing. What is new is a source of products that is a LIST rather than a
 * match, and the three ways a list behaves differently:
 *
 *  1. ORDER IS CONTENT. The shop puts its best seller first. No property of
 *     the products can recover that afterwards, so a resolver that returns
 *     them in catalogue order has silently thrown the curation away.
 *  2. A NAME MATCH IS NOT MEMBERSHIP. "Diwali Gifts" the collection and
 *     "Diwali Gifts" the category are different things. A collection that
 *     quietly grew by name would stop being a curation the moment somebody
 *     created a category with the same words.
 *  3. IDS OUTLIVE WHAT THEY POINT AT. Storing ids on the collection is what
 *     buys the ordering; the price is a dangling id when a product is deleted,
 *     and an `undefined` reaching ProductCard takes the page down.
 *
 * And underneath all three, the reason this repo writes guards at all: a new
 * catalog section is FOUR enumerated lists that must agree — the Mongoose
 * path, the section schemas, the defaults map and the browser's own list.
 * Miss one and the write is accepted and lost, or the Reset button 404s, or
 * the server's copy never reaches the browser.
 */
import { describe, expect, it } from "vitest";

import { productsInCollection } from "@/features/products/lib/product-catalog";
import { overlayServerSections } from "@/components/shared/catalog-server-sync";
import { CATALOG_SECTIONS } from "@/features/catalog/lib/catalog-api";
import {
  catalogSectionDefaults,
  defaultCollections,
} from "@/features/catalog/lib/catalog-utils";
import type { LandingProduct } from "@/constants/landing-data";
import type { CatalogStore } from "@/types/catalog";

function product(id: string, overrides: Partial<LandingProduct> = {}): LandingProduct {
  return {
    id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    price: 500,
    image: "",
    category: "Cakes",
    categories: ["Cakes"],
    ...overrides,
  } as LandingProduct;
}

/** Five products, one of which is NAMED after the collection but not in it. */
const CATALOG: LandingProduct[] = [
  product("p1"),
  product("p2"),
  product("p3"),
  product("p4"),
  product("decoy", {
    name: "Diwali Gifts Hamper",
    category: "Diwali Gifts",
    categories: ["Diwali Gifts"],
  }),
];

describe("a collection shows what the owner picked, in the order they picked it", () => {
  it("returns exactly the picked products, in the picked order", () => {
    /**
     * ['p4','p1','p3'] — deliberately NOT catalogue order. A resolver that
     * walks the catalogue and tests membership returns p1, p3, p4 and passes a
     * length check while having lost the one thing the owner did here.
     */
    const picked = productsInCollection(CATALOG, ["p4", "p1", "p3"]);

    expect(picked.map((item) => item.id)).toEqual(["p4", "p1", "p3"]);
  });

  it("does not sweep in a product that merely shares its name", () => {
    const picked = productsInCollection(CATALOG, ["p4", "p1", "p3"]);

    expect(picked.map((item) => item.name)).not.toContain("Diwali Gifts Hamper");
  });

  it("leaves a shorter list when a picked product is deleted, never a hole", () => {
    /**
     * The accepted cost of storing ids on the collection. Without the filter an
     * `undefined` lands in the array and the storefront dies on `cake.id`
     * inside ProductCard — the same tolerance `product-mapper` already applies
     * to a category id the shop has since deleted.
     */
    const picked = productsInCollection(CATALOG, ["p1", "gone", "p3"]);

    expect(picked).toHaveLength(2);
    expect(picked.every(Boolean)).toBe(true);
    expect(picked.map((item) => item.id)).toEqual(["p1", "p3"]);
  });

  it("is empty for a collection nobody has filled yet", () => {
    // A real and common state: the owner names the group, then fills it.
    expect(productsInCollection(CATALOG, [])).toEqual([]);
  });

  it("ships no collections of its own", () => {
    /**
     * Categories and occasions ship a starter list because a shop cannot file a
     * product without a category. A collection is a CURATION — a shipped one
     * would put a group on the storefront that the owner never made, with
     * products in it chosen by nobody. This is also what Reset restores.
     */
    expect(defaultCollections).toEqual([]);
    expect(catalogSectionDefaults.collections).toEqual([]);
  });
});

describe("the four lists a catalog section has to appear in", () => {
  it("is a section the browser can name and the server will accept", () => {
    expect([...CATALOG_SECTIONS]).toContain("collections");
  });

  it("and one the shop can reset", () => {
    // A schema with no default accepts writes and 404s on its own Reset button.
    expect(Object.hasOwn(catalogSectionDefaults, "collections")).toBe(true);
  });

  it("and one the Mongoose schema will actually store", async () => {
    /**
     * The silent-drop class, in memory and with no database.
     *
     * This schema is built with no options, so Mongoose `strict` is on: an
     * undeclared path is dropped on write while the API answers 200 and the
     * admin re-renders its own state as though it had saved. This repo has been
     * bitten four times.
     */
    const { CatalogModel } = await import("@/lib/server/db/models/catalog.model");

    const doc = new CatalogModel({
      key: "singleton",
      collections: [
        { id: "col-1", name: "Diwali Gifts", slug: "diwali-gifts", productIds: ["p1", "p2"] },
      ],
    } as never);

    const stored = doc.toObject() as unknown as {
      collections: { productIds: string[] }[];
    };
    expect(stored.collections).toHaveLength(1);
    expect(stored.collections[0].productIds).toEqual(["p1", "p2"]);
  });

  it("and one that survives the `doc.set` the repository actually uses", async () => {
    /**
     * `updateSection` writes with `doc.set(section, value)`, not through the
     * constructor — a different path through strict mode, and the one every
     * real write takes.
     */
    const { CatalogModel } = await import("@/lib/server/db/models/catalog.model");

    const doc = new CatalogModel({ key: "singleton" } as never);
    doc.set("collections", [
      { id: "col-2", name: "Under 500", slug: "under-500", productIds: ["p3"] },
    ]);

    const stored = doc.toObject() as unknown as {
      collections: { slug: string; productIds: string[] }[];
    };
    expect(stored.collections?.[0]?.slug).toBe("under-500");
    expect(stored.collections?.[0]?.productIds).toEqual(["p3"]);
  });
});

describe("the server's copy of every section reaches the browser", () => {
  const store = (collections: unknown[]): CatalogStore =>
    ({
      categories: [{ id: "cat-1", name: "Cakes", slug: "cakes" }],
      occasions: [{ id: "oc-1", name: "Birthday", slug: "birthday" }],
      collections,
      updatedAt: "",
    }) as unknown as CatalogStore;

  it("carries a section the hand-written overlay would have missed", () => {
    /**
     * The overlay was two literal lines — categories and occasions — so a third
     * section was simply not carried. The browser would keep its empty local
     * array, the hydration gate would still mark itself settled, and the next
     * replace-all would publish that emptiness over the shop's real
     * collections. Nothing logs; the section is just gone.
     */
    const REAL = [{ id: "col-1", name: "Diwali Gifts", slug: "diwali-gifts", productIds: [] }];

    const merged = overlayServerSections(store([]), store(REAL));

    expect(merged.collections).toEqual(REAL);
  });

  it("and keeps what the browser holds when the server says nothing about it", () => {
    /**
     * The converse, and the reason it is `?? current[section]` rather than
     * `?? []`: a server that omits a section is saying nothing about it, not
     * saying it is empty.
     */
    const LOCAL = [{ id: "col-9", name: "Mine", slug: "mine", productIds: ["p1"] }];
    const fromServer = { categories: store([]).categories } as Partial<CatalogStore>;

    const merged = overlayServerSections(store(LOCAL), fromServer);

    expect(merged.collections).toEqual(LOCAL);
  });

  it("and carries every section the constant names, not a hardcoded few", () => {
    /**
     * The property that makes the next section free. Asserted over the constant
     * rather than over three literal keys, so adding a fourth cannot quietly
     * skip the overlay the way the third did.
     */
    const current = store([]) as unknown as Record<string, unknown>;
    const server: Record<string, unknown> = {};
    for (const section of CATALOG_SECTIONS) server[section] = [{ id: `from-server-${section}` }];

    const merged = overlayServerSections(
      current as unknown as CatalogStore,
      server as unknown as Partial<CatalogStore>,
    ) as unknown as Record<string, { id: string }[]>;

    for (const section of CATALOG_SECTIONS) {
      expect(merged[section]?.[0]?.id, `${section} was not carried`).toBe(
        `from-server-${section}`,
      );
    }
  });
});
