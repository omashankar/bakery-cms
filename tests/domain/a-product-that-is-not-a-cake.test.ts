import { describe, expect, it, vi } from "vitest";

/**
 * A shop that sells a phone charger should not be asked whether it is eggless.
 *
 * Business type restricts nothing — that was audited and proved. What made the
 * CMS *feel* bakery-only is that every product was born a cake: three read-path
 * and form-path fallbacks invented cake data for anything that arrived without
 * it. A charger got an "Egg preference" group (Regular / Eggless +80), the
 * shipped Round/Square/Heart shapes, and 0.5 kg / 1 kg / 1.5 kg weight tiers,
 * and the owner had to delete them by hand on every single product.
 *
 * These pin the two halves that matter:
 *
 *   1. A product with no cake fields must survive CHECKOUT. `getProductVariantGroups`
 *      reads `cake.category.toLowerCase()` on its fallback branch, but `priceCart`
 *      passes a repository `Product`, which declares `categoryId` and has no
 *      `category` at all. The branch was unreachable only because the read-path
 *      injection guaranteed every product had stored groups — so removing the
 *      injection, which is the whole point of this work, is what makes the crash
 *      reachable. `/api/checkout/quote` would answer 500 instead of a clean 409.
 *
 *   2. Nothing invents cake data for a product that never had any.
 *
 * The bakery cases are asserted alongside, because the existing shop must not
 * move: a product that DOES carry stored groups keeps them untouched.
 */

const state = vi.hoisted(() => ({}));
void state;

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async (slug: string) =>
    slug in CATALOGUE ? { slug, ...CATALOGUE[slug] } : null,
  listBySlugs: async () => [],
  patch: async () => null,
}));

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({ commerce: {}, general: { currency: "INR" } }),
}));

vi.mock("@/features/commerce/server/commerce.service", () => ({
  getCoupons: async () => [],
  getZones: async () => [],
}));

/**
 * Shaped like what the REPOSITORY actually returns — a `Product`.
 *
 * Deliberately no `category` key: that is the field the crash reads, and every
 * pre-existing pricing fixture in this repo supplies it by hand, which is why a
 * fully green suite never noticed. Do not add one to make a test pass.
 */
const CATALOGUE: Record<string, Record<string, unknown>> = {
  "type-c-charger": {
    name: "65W Type-C Charger",
    price: 1499,
    images: ["/charger.jpg"],
    categoryId: "cat-chargers",
    weights: [],
    variantGroups: [],
    isEggless: false,
    allowsPhotoUpload: false,
  },
};

import { priceCart } from "@/features/checkout/server/pricing.server";
import {
  getProductVariantGroups,
  normalizeVariantGroups,
} from "@/features/products/lib/variant-utils";
import { normalizeCommerceFields } from "@/features/products/lib/products-repository";
import { getDefaultWeights, rederiveWeights } from "@/features/products/lib/catalog-options";
import type { Product } from "@/types/product";

/** The shape the repository hands the pricing path: a Product, not a LandingProduct. */
const charger = {
  id: "p-charger",
  name: "65W Type-C Charger",
  slug: "type-c-charger",
  price: 1499,
  images: ["/charger.jpg"],
  categoryId: "cat-chargers",
  weights: [],
  variantGroups: [],
  shapes: [],
  flavourOptions: [],
  occasionIds: [],
  isEggless: false,
  isPhotoCake: false,
} as unknown as Product;

describe("checkout survives a product that carries no cake fields", () => {
  it("prices a charger without throwing", async () => {
    // Before the fix this was a TypeError on `cake.category.toLowerCase()`,
    // which the route turns into a 500 — not the clean 409 an unsellable line
    // is supposed to get.
    const quote = await priceCart({
      items: [{ productSlug: "type-c-charger", quantity: 1 }],
    });

    expect(quote.items[0].price).toBe(1499);
  });

  it("charges the base price, with no surcharge from a group nobody configured", async () => {
    const quote = await priceCart({
      items: [{ productSlug: "type-c-charger", quantity: 2 }],
    });

    // 1499, not 1579. An injected "Egg preference" group defaults to Regular
    // (+0) for a non-eggless product, but the group still reached the order
    // line and the picker.
    expect(quote.items[0].price).toBe(1499);
    expect(quote.totals.subtotal).toBe(2998);
    expect(quote.items[0].variantSummary).toEqual([]);
  });
});

describe("nothing invents cake data for a product that never had any", () => {
  it("gives a charger no variant groups at all", () => {
    expect(getProductVariantGroups(charger as never)).toEqual([]);
    expect(normalizeVariantGroups(charger)).toEqual([]);
  });

  it("does not stamp Round / Square / Heart onto a charger", () => {
    const normalized = normalizeCommerceFields(charger);

    expect(normalized.shapes).toEqual([]);
    expect(normalized.variantGroups).toEqual([]);
  });
});

describe("sizes are opt-in, and the choice survives editing the price", () => {
  it("keeps a one-size product at one size when its price changes", () => {
    /**
     * `rederiveWeights` always returned `getDefaultWeights(next).map(...)` — the
     * shop's catalog presets — so a product with no tiers grew three of them on
     * the first keystroke in the Price field. Clearing the tiers on a charger
     * never stuck, because the next price edit put them back.
     */
    expect(rederiveWeights([], 1499, 999)).toEqual([]);
  });

  it("still re-prices the tiers of a product that has them", () => {
    // The behaviour this function exists for must not have been traded away.
    const tiers = getDefaultWeights(1000);
    const rederived = rederiveWeights(tiers, 1200, 1000);

    expect(rederived).toHaveLength(tiers.length);
    expect(rederived[0].price).toBe(tiers[0].price + 200);
  });

  it("gives the admin's opt-in button real tiers, priced from this product", () => {
    // What "Sell this by size" puts into the form.
    const tiers = getDefaultWeights(1499);

    expect(tiers.length).toBeGreaterThan(0);
    expect(tiers[0].price).toBe(1499);
    expect(tiers.every((tier) => tier.label.trim().length > 0)).toBe(true);
  });
});

describe("the bakery does not move", () => {
  /** A cake the shop HAS configured — stored groups, which must survive untouched. */
  const cake = {
    id: "p-bf",
    name: "Black Forest",
    slug: "black-forest",
    price: 999,
    images: ["/bf.jpg"],
    categoryId: "cat-cakes",
    weights: [{ label: "1 kg", price: 999 }],
    shapes: ["Round", "Heart"],
    flavourOptions: ["Chocolate"],
    occasionIds: [],
    isEggless: true,
    isPhotoCake: false,
    variantGroups: [
      {
        id: "g-egg",
        name: "Egg preference",
        type: "egg",
        required: true,
        options: [
          { id: "o-reg", label: "Regular", priceAdjustment: 0 },
          { id: "o-egl", label: "Eggless", semantic: "eggless", priceAdjustment: 80, isDefault: true },
        ],
      },
    ],
  } as unknown as Product;

  it("keeps a configured cake's groups, shapes and defaults exactly as stored", () => {
    const normalized = normalizeCommerceFields(cake);

    expect(normalized.shapes).toEqual(["Round", "Heart"]);
    expect(normalized.variantGroups).toHaveLength(1);
    expect(normalized.variantGroups[0].name).toBe("Egg preference");
    // The stored default still wins, so the eggless cake still costs what it did.
    const chosen = normalized.variantGroups[0].options.find((o) => o.isDefault);
    expect(chosen?.label).toBe("Eggless");
    expect(chosen?.priceAdjustment).toBe(80);
  });

  it("still upgrades legacy stored options that predate `semantic`", () => {
    // backfillLegacyGroups is the one place a label may be inspected, and it
    // must keep working — it is what makes old records readable.
    const legacy = {
      ...cake,
      variantGroups: [
        {
          id: "g-egg",
          name: "Egg preference",
          type: "egg",
          required: true,
          options: [{ id: "o-egl", label: "Eggless upgrade", priceAdjustment: 80 }],
        },
      ],
    } as unknown as Product;

    expect(normalizeVariantGroups(legacy)[0].options[0].semantic).toBe("eggless");
  });
});
