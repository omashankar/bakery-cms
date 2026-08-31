import { describe, expect, it, vi } from "vitest";

/**
 * The order has to say what the customer picked, not just what it cost.
 *
 * `QuotedLine` declared `variantSummary?: string[]` and nothing ever assigned
 * it — `formatVariantSummary` was not even imported into pricing.server.ts. So
 * the field was empty on every order this shop has ever taken, and the six
 * surfaces that would show it (admin order detail, invoice, checkout summary,
 * the account order list, and both emails) had nothing to show. The kitchen
 * email read "2 x Black Forest": no size, no flavour, no message.
 *
 * The customer WAS charged for those choices the whole time — `priceLine`
 * applies every enabled group's adjustment, falling back to the group default
 * when no selection arrives. So the shop billed for a decision it then threw
 * away, and the baker had to guess.
 *
 * These pin the rule the fix establishes: **the summary describes exactly the
 * groups the price was computed from.** Same groups, same fallback, same module
 * gate — otherwise the order would narrate one thing and charge another, which
 * is worse than saying nothing.
 *
 * The real `priceCart` runs here; only Mongo and settings are stubbed, so the
 * arithmetic under test is the arithmetic checkout uses.
 */

/**
 * Shaped like a real catalogue document.
 *
 * `category` is set by hand on every fixture deliberately. `getProductVariantGroups`
 * reads `cake.category.toLowerCase()` on its fallback branch, but the repository
 * returns a `Product`, which has `categoryId` and no `category` at all. The
 * fallback is unreachable while these fixtures carry stored `variantGroups` —
 * remove them and this file would report a TypeError rather than a price.
 */
const CATALOGUE: Record<string, Record<string, unknown>> = {
  // A product with nothing bakery about it: no flavour, no weights, no egg.
  "type-c-charger": {
    name: "65W Type-C Charger",
    price: 1499,
    images: ["/charger.jpg"],
    category: "Chargers",
    weights: [],
    variantGroups: [
      {
        id: "g-cable",
        name: "Cable length",
        type: "custom",
        required: true,
        options: [
          { id: "o-1m", label: "1 m", priceAdjustment: 0, isDefault: true },
          { id: "o-2m", label: "2 m", priceAdjustment: 200 },
        ],
      },
    ],
  },
  // A bakery product, so the fix can be shown not to move the existing shop.
  "black-forest": {
    name: "Black Forest",
    price: 999,
    images: ["/bf.jpg"],
    category: "Cakes",
    weights: [],
    variantGroups: [
      {
        id: "g-egg",
        name: "Egg preference",
        type: "egg",
        required: true,
        options: [
          { id: "o-reg", label: "Regular", priceAdjustment: 0, isDefault: true },
          { id: "o-egl", label: "Eggless", semantic: "eggless", priceAdjustment: 80 },
        ],
      },
    ],
  },
};

const state = vi.hoisted(() => ({
  modules: undefined as Record<string, boolean> | undefined,
}));

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async (slug: string) =>
    slug in CATALOGUE ? { slug, ...CATALOGUE[slug] } : null,
  listBySlugs: async () => [],
  patch: async () => null,
}));

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({
    commerce: {},
    general: { currency: "INR" },
    // Undefined means "not stored", which priceCart fills with every module ON.
    ...(state.modules ? { modules: state.modules } : {}),
  }),
}));

vi.mock("@/features/commerce/server/commerce.service", () => ({
  getCoupons: async () => [],
  getZones: async () => [],
}));

import { priceCart } from "@/features/checkout/server/pricing.server";

/** One line, priced by the server exactly as checkout prices it. */
async function quoteOne(
  productSlug: string,
  variantSelections?: Record<string, string>,
) {
  const quote = await priceCart({
    items: [{ productSlug, quantity: 1, ...(variantSelections ? { variantSelections } : {}) }],
  });
  return quote.items[0];
}

describe("a priced line says what was chosen", () => {
  it("records the option the customer actually picked", async () => {
    const line = await quoteOne("type-c-charger", { "g-cable": "o-2m" });

    // The money was never the broken half.
    expect(line.price).toBe(1699);
    // This is: the order has to carry the choice that produced that number.
    expect(line.variantSummary).toEqual(["Cable length: 2 m"]);
  });

  it("names the default when the customer chose nothing, because the default is what is charged", async () => {
    // `calculateVariantAdjustment` falls back to the default option whenever a
    // selection is absent, so an order that stayed silent about the group would
    // be describing a price it did not explain.
    const line = await quoteOne("type-c-charger");

    expect(line.price).toBe(1499);
    expect(line.variantSummary).toEqual(["Cable length: 1 m"]);
  });

  it("works for a product with no bakery fields at all", async () => {
    // No flavour, no weights, no shapes, no egg group — the generic mechanism
    // the multi-category catalogue rests on.
    const line = await quoteOne("type-c-charger", { "g-cable": "o-1m" });

    expect(line.name).toBe("65W Type-C Charger");
    expect(line.image).toBe("/charger.jpg");
    expect(line.variantSummary).toHaveLength(1);
  });
});

describe("the summary and the price come from the same groups", () => {
  it("says Eggless when it charged for Eggless", async () => {
    const line = await quoteOne("black-forest", { "g-egg": "o-egl" });

    expect(line.price).toBe(1079);
    expect(line.variantSummary).toEqual(["Egg preference: Eggless"]);
  });

  it("omits a group the shop has switched off — the same group it does not charge for", async () => {
    /**
     * A module that is off used to hide only the PICKER, so an eggless cake was
     * still charged its +80 default and still stamped "Egg preference: Eggless"
     * on an order line for a choice the customer was never shown.
     * `variantGroupsEnabledBy` removes the group from PRICING; the summary has
     * to be built from that same filtered list, or the order narrates a group
     * the shop does not sell.
     */
    state.modules = { eggEggless: false };
    try {
      const line = await quoteOne("black-forest", { "g-egg": "o-egl" });

      expect(line.price).toBe(999);
      expect(line.variantSummary).toEqual([]);
    } finally {
      state.modules = undefined;
    }
  });
});
