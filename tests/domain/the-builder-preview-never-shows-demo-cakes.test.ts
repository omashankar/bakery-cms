/**
 * The homepage product rows must only ever contain the shop's OWN cakes.
 *
 * The builder preview passes no `rails`, so the renderer fell back to
 * `getHomepageProducts`, whose catalogue pool was `getAllProducts()` — that is
 * `mergeStorefrontProducts()`, which STARTS from the 37 hardcoded cakes in
 * constants/landing-data.ts and only overwrites the ones whose slug a real
 * product happens to share. Everything else survived, ahead of the shop's own.
 *
 * The pool is used twice in `buildHomepageProducts`: as the badge/category
 * match, and as the top-up that keeps a grid full when too few cakes carry a
 * flag. So a shop with four cakes previewed six product grids and four of them
 * contained none of its cakes at all — then published a homepage nobody had
 * seen, because the storefront builds the same rails from published products
 * alone and the demo cakes can never reach it.
 *
 * The real cure is that the builder now fetches the server's rails from
 * /api/builders/homepage/preview-data. This pins the fallback underneath it, so
 * the moment before that lands — and any future caller — still cannot invent a
 * cake the shop does not sell.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/types/product";

const shopProducts = vi.hoisted(() => ({ current: [] as Product[] }));

vi.mock("@/features/products/lib/products-repository", () => ({
  loadProducts: () => shopProducts.current,
}));

const { getHomepageProducts } = await import("@/features/products/lib/homepage-catalog");
const demoData = await import("@/constants/landing-data");

/** The shipped demo cakes, the pool this fallback used to draw from. */
const DEMO_CAKES = [
  ...demoData.featuredProducts,
  ...demoData.trendingProducts,
  ...demoData.bestSellers,
  ...demoData.photoCakes,
  ...demoData.egglessCakes,
  ...demoData.seasonalCakes,
];

/** Every row the homepage can show — kept in step with HomepageProductSource. */
const HOMEPAGE_SOURCES = [
  "featured",
  "trending",
  "best-sellers",
  "photo-cakes",
  "eggless",
  "seasonal",
] as const;

function cake(over: Partial<Product> & { slug: string }): Product {
  return {
    id: over.slug,
    name: over.slug,
    description: "",
    price: 500,
    images: ["https://example.com/cake.jpg"],
    categoryId: "cat-cakes",
    occasionIds: [],
    weights: [],
    status: "published",
    isFeatured: false,
    isBestSeller: false,
    isTrending: false,
    isPhotoCake: false,
    isEggless: false,
    isSeasonal: false,
    shapes: [],
    flavourOptions: [],
    stockStatus: "in-stock",
    stockQuantity: 10,
    unlimitedStock: true,
    allowsMessage: false,
    allowsPhotoUpload: false,
    variantGroups: [],
    rating: 0,
    reviewCount: 0,
    ...over,
  } as Product;
}

/** Four cakes, one flagged for each of the first four rows. */
const SHOP: Product[] = [
  cake({ slug: "shop-choco", isFeatured: true }),
  cake({ slug: "shop-vanilla", isTrending: true }),
  cake({ slug: "shop-red-velvet", isBestSeller: true }),
  cake({ slug: "shop-pineapple", isPhotoCake: true }),
];

const SHOP_SLUGS = new Set(SHOP.map((item) => item.slug));

beforeEach(() => {
  shopProducts.current = SHOP;
});

describe("the product rows the builder falls back to", () => {
  it("is asserting against a demo catalogue that really exists", () => {
    // Anti-vacuity. If the shipped catalogue were empty, or already shared our
    // fixture's slugs, every assertion below would pass for the wrong reason.
    expect(DEMO_CAKES.length).toBeGreaterThan(10);
    expect(DEMO_CAKES.some((item) => SHOP_SLUGS.has(item.slug))).toBe(false);
  });

  it.each(HOMEPAGE_SOURCES)("shows only the shop's own cakes in the %s row", (source) => {
    const rail = getHomepageProducts(source, 4);
    const strangers = rail.map((item) => item.slug).filter((slug) => !SHOP_SLUGS.has(slug));

    expect(
      strangers,
      `the ${source} row offered cakes this shop does not sell: ${strangers.join(", ")}`,
    ).toEqual([]);
  });

  it("still fills the rows it can", () => {
    // The rows must not be empty for the wrong reason either — an implementation
    // returning [] everywhere would satisfy the assertion above.
    expect(getHomepageProducts("featured", 4).length).toBeGreaterThan(0);
    expect(getHomepageProducts("trending", 4).length).toBeGreaterThan(0);
  });

  it("has nothing to show for a shop with no products", () => {
    shopProducts.current = [];
    for (const source of HOMEPAGE_SOURCES) {
      expect(
        getHomepageProducts(source, 4),
        `${source} invented cakes for a shop that has none`,
      ).toEqual([]);
    }
  });
});
