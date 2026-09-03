import { describe, expect, it, vi } from "vitest";

/**
 * A line built before shapes became a variant group, priced after.
 *
 * `shapes: string[]` and a flat `shape` on the cart line became a typed variant
 * group. Two kinds of line still carry the old field: one built by Reorder from
 * an order placed before the change, and one sitting in a customer's
 * localStorage cart from before the deploy — carts have no expiry, so those keep
 * arriving for as long as the browser keeps them.
 *
 * Priced as it stood, such a line said the shape TWICE and could say two
 * different things: `...line` kept "Heart" while `formatVariantSummary` fell
 * back to the group's default and added "Shape: Round". `cartLineChoices`
 * concatenates both, so the confirmation, the invoice and the KITCHEN EMAIL all
 * read "Heart · Shape: Round" — and the kitchen copy is the one acted on.
 */
const SHAPE_GROUP = {
  id: "g-shape",
  name: "Shape",
  type: "shape",
  options: [
    { id: "round", label: "Round", priceAdjustment: 0, isDefault: true },
    { id: "heart", label: "Heart", priceAdjustment: 150 },
  ],
};

const PRODUCT = {
  id: "p1",
  name: "Black Forest",
  slug: "black-forest",
  price: 800,
  images: ["/bf.jpg"],
  status: "published",
  inStock: true,
  weights: [],
  variantGroups: [SHAPE_GROUP],
};

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: vi.fn(async () => PRODUCT),
  listAll: vi.fn(async () => [PRODUCT]),
}));
vi.mock("@/features/settings/server/settings.service", () => ({
  getPublicSettings: vi.fn(async () => ({})),
  getSettings: vi.fn(async () => ({})),
}));
// `pricing.server` reads these from the SERVICE, not the repository.
vi.mock("@/features/commerce/server/commerce.service", () => ({
  getCoupons: vi.fn(async () => []),
  getZones: vi.fn(async () => []),
}));

async function quote(line: Record<string, unknown>) {
  const { priceCart } = await import("@/features/checkout/server/pricing.server");
  const result = await priceCart({
    items: [{ productSlug: "black-forest", quantity: 1, ...line }],
  } as never);
  return result.items[0] as { shape?: string; variantSummary?: string[]; price: number };
}

describe("a cart line from before shapes were a group", () => {
  it("states the shape once, through the group", async () => {
    const line = await quote({ shape: "Heart" });

    expect(line.variantSummary).toContain("Shape: Heart");
    // The old field is cleared, or `cartLineChoices` prints both.
    expect(line.shape).toBeUndefined();
  });

  it("keeps the shape the customer actually chose", async () => {
    /**
     * Mapped, not dropped. Dropping the old value would silently turn a
     * reordered Heart into whatever the group defaults to — the same damage in
     * the other direction, and invisible, because the re-quote agrees on price
     * only if the surcharge happens to match.
     */
    const line = await quote({ shape: "Heart" });

    expect(line.variantSummary).toContain("Shape: Heart");
    expect(line.variantSummary).not.toContain("Shape: Round");
    // Heart costs Rs 150 more, and the price has to follow the choice.
    expect(line.price).toBe(950);
  });

  it("matches the old wording however it was capitalised", async () => {
    const line = await quote({ shape: "  heart " });

    expect(line.variantSummary).toContain("Shape: Heart");
  });

  it("leaves a real selection alone", async () => {
    // A line from AFTER the change carries the selection. The legacy field must
    // not be allowed to override it.
    const line = await quote({
      shape: "Heart",
      variantSelections: { "g-shape": "round" },
    });

    expect(line.variantSummary).toContain("Shape: Round");
    expect(line.price).toBe(800);
  });

  it("falls back to the group default for a shape it cannot match", async () => {
    // A shape the shop has since removed. There is nothing honest to select, so
    // the group answers for itself rather than the line asserting a shape that
    // is no longer on offer.
    const line = await quote({ shape: "Rectangle" });

    expect(line.shape).toBeUndefined();
    expect(line.variantSummary).toContain("Shape: Round");
  });
});
