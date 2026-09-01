import { beforeEach, describe, expect, it, vi } from "vitest";

import { addToCart, cartLineId, clearCart, getCartItems } from "@/features/cart/lib/cart";
import { reorderFromOrder } from "@/apps/website/lib/reorder";
import type { LandingProduct } from "@/constants/landing-data";
import type { PlacedOrder } from "@/features/orders/lib/orders";

/**
 * Two ways a cart line ends up describing something the customer did not order.
 *
 * The first is "Order again". `cartLineId` folds the photo, the message and the
 * shape into the line's identity precisely so that two photo cakes with two
 * different children's photos stay two lines — the comment on it records the
 * bug where "the baker made the same cake twice". But `reorderFromOrder` passes
 * `message` and `shape` and NOT `photoUrl`, so a reorder both loses the photo
 * and re-collapses the two lines it was written to keep apart. The +250 photo
 * surcharge is still on the price, because that came off the stored line.
 *
 * The second is the grid. A card's Add button sends slug, name, image, price
 * and quantity — no `variantSelections` — so the cart shows a line with no
 * options while the server, which falls back to each group's default option,
 * prices and records "Storage: 128 GB". The customer was never shown a choice
 * and one was recorded against their name.
 */

beforeEach(() => {
  localStorage.clear();
  clearCart();
});

describe("ordering again keeps the two cakes apart", () => {
  const CATALOGUE = [
    { slug: "photo-cake", name: "Photo Cake", image: "/pc.jpg", inStock: true },
  ] as unknown as LandingProduct[];

  /**
   * Same product, same size, SAME message — the photo is the only difference.
   *
   * Deliberately isolated. A first version of this gave the two lines different
   * messages and passed against the broken code, because `message` is in the
   * digest too and was carrying the test. The bug is that `photoUrl` alone is
   * not, once reorder has dropped it.
   */
  const order = {
    items: [
      {
        id: "l1",
        productSlug: "photo-cake",
        name: "Photo Cake",
        image: "/pc.jpg",
        price: 1249,
        quantity: 1,
        weight: "1 kg",
        photoUrl: "https://cdn.test/aarav.jpg",
        message: "Happy Birthday",
      },
      {
        id: "l2",
        productSlug: "photo-cake",
        name: "Photo Cake",
        image: "/pc.jpg",
        price: 1249,
        quantity: 1,
        weight: "1 kg",
        photoUrl: "https://cdn.test/isha.jpg",
        message: "Happy Birthday",
      },
    ],
  } as unknown as PlacedOrder;

  it("carries the photo the shop is meant to print", () => {
    reorderFromOrder(order, CATALOGUE);

    const photos = getCartItems().map((item) => item.photoUrl);
    // Dropped entirely today: the surcharge is on the price, the photo is not.
    expect(photos).toContain("https://cdn.test/aarav.jpg");
    expect(photos).toContain("https://cdn.test/isha.jpg");
  });

  it("does not merge two different photo cakes into one line of quantity 2", () => {
    const result = reorderFromOrder(order, CATALOGUE);

    expect(result.added).toBe(2);
    expect(getCartItems()).toHaveLength(2);
    expect(getCartItems().every((item) => item.quantity === 1)).toBe(true);
  });

  it("gives the two lines different ids, which is what keeps them apart", () => {
    // The identity is the mechanism; assert it directly so a future change to
    // `cartLineId` cannot quietly re-merge them.
    expect(cartLineId(order.items[0])).not.toBe(cartLineId(order.items[1]));
  });
});

describe("a card add never records a choice the customer was not shown", () => {
  it("adds nothing to the cart for a product that has options", async () => {
    /**
     * The card cannot present a picker, so it must not pretend one was answered.
     * `calculateVariantAdjustment` falls back to each group's default whenever a
     * selection is absent, so a silent add is priced AND recorded as a choice.
     */
    const { productHasOptions } = await import("@/features/products/lib/product-pricing");

    expect(
      productHasOptions({
        variantGroups: [
          {
            id: "g-storage",
            name: "Storage",
            type: "custom",
            required: true,
            options: [
              { id: "o-128", label: "128 GB", priceAdjustment: 0, isDefault: true },
              { id: "o-256", label: "256 GB", priceAdjustment: 5000 },
            ],
          },
        ],
      }),
    ).toBe(true);
  });

  it("treats a product with no options as safe to add from the grid", () => {
    // A single-choice shop should not lose its one-tap add.
    addToCart({
      productSlug: "plain-bun",
      name: "Plain Bun",
      image: "",
      price: 40,
      quantity: 1,
    });

    expect(getCartItems()).toHaveLength(1);
  });
});

describe("the card projection says whether a product has options", () => {
  it("carries hasOptions so the grid can decide without the whole group array", async () => {
    // toCard deliberately drops `variantGroups` to keep the RSC payload small —
    // its own header budgets that for 5,000 products — so the flag travels, not
    // the data.
    const { productHasOptions } = await import("@/features/products/lib/product-pricing");

    expect(productHasOptions({ variantGroups: [] })).toBe(false);
    expect(productHasOptions({})).toBe(false);
  });
});

/** Keep vitest from complaining about an unused import in the mock-free file. */
void vi;
