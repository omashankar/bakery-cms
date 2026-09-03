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

/** Named by the shop, not typed — a Flavour group is just a custom group. */
const FLAVOUR_GROUP = {
  id: "g-flavour",
  name: "Flavour",
  type: "custom",
  options: [
    { id: "choc", label: "Chocolate", priceAdjustment: 0, isDefault: true },
    { id: "vanilla", label: "Vanilla", priceAdjustment: 60 },
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
  // Tier 0 is the base price, so every price assertion below is unchanged by
  // this — it is here so the quote has a size to put a name to.
  weights: [{ label: "1 kg", price: 800 }],
  weightLabel: "Tin size",
  variantGroups: [SHAPE_GROUP, FLAVOUR_GROUP],
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

describe("a cart line from before flavour was a group", () => {
  it("states the flavour once, through the group, and keeps the choice", async () => {
    /**
     * `flavourOptions` was a SECOND option system — an unpriced list of names
     * with its own hard-coded “Flavour” picker, two lines above a loop that
     * already rendered every group by its own name. Retiring it leaves the same
     * legacy field on old lines that `shape` left, and the same doubling if it
     * is not mapped.
     */
    const line = (await quote({ flavour: "Vanilla" })) as unknown as {
      flavour?: string;
      variantSelections?: Record<string, string>;
      variantSummary?: string[];
      price: number;
    };

    expect(line.variantSummary).toContain("Flavour: Vanilla");
    expect(line.flavour).toBeUndefined();
    expect(line.variantSelections?.["g-flavour"]).toBe("vanilla");
    // Vanilla costs 60 more, and the price has to follow the mapped choice.
    expect(line.price).toBe(860);
  });

  it("keeps a legacy flavour the group cannot match", async () => {
    const line = await quote({ flavour: "Butterscotch" });

    expect(line.shape).toBeUndefined();
    expect((line as unknown as { flavour?: string }).flavour).toBe("Butterscotch");
    expect(line.variantSummary).toContain("Flavour: Chocolate");
  });
});

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

  it("keeps a legacy shape the group cannot match", async () => {
    /**
     * A shape the shop has since renamed or removed. There is nothing honest
     * to SELECT — so the group answers for itself — but the customer’s own word
     * is kept rather than deleted.
     *
     * Clearing it here was my first attempt and it is worse than the doubling
     * it was meant to end: “Rectangle · Shape: Round” is contradictory and a
     * baker can SEE the contradiction, while dropping “Rectangle” bakes a round
     * cake with no record anywhere that somebody asked for something else.
     */
    const line = await quote({ shape: "Rectangle" });

    expect(line.shape).toBe("Rectangle");
    expect(line.variantSummary).toContain("Shape: Round");
  });

  it("records the mapped choice, not only the words on screen", async () => {
    /**
     * The mapping went into a local that `priceLine` never returned, so the
     * stored line kept neither the flat `shape` nor a selection — the choice
     * survived as display text alone. A reorder then showed “Shape: Heart” from
     * the copied summary while the re-quote recorded and cooked “Shape: Round”,
     * and with every migrated option priced at 0 nothing moved to warn anyone.
     *
     * It also let two lines collapse: with no selection and no shape,
     * `cartLineId` keys both a Heart and a Round of the same cake as
     * “default”, and `addToCart` merges them.
     */
    const line = (await quote({ shape: "Heart" })) as unknown as {
      variantSelections?: Record<string, string>;
    };

    expect(line.variantSelections?.["g-shape"]).toBe("heart");
  });
});

describe("the size the customer chose, called what the shop calls it", () => {
  it("stamps the shop's word onto the priced line", async () => {
    /**
     * The ORDER is built from `quote.items`, so this is what the invoice, the
     * account order list and the email to the kitchen read. Taken from the
     * PRODUCT and never from the line: what a choice is CALLED is the shop's to
     * say, and a line that sat in a browser since before a rename would
     * otherwise print the old word on a new invoice.
     */
    const line = (await quote({ weight: "1 kg" })) as unknown as { weightLabel?: string };

    expect(line.weightLabel).toBe("Tin size");
  });
});
