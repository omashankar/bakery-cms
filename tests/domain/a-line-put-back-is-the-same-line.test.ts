import { beforeEach, describe, expect, it } from "vitest";

import {
  addToCart,
  cartLineToAddInput,
  getCartItems,
  moveCartItemToSavedForLater,
  restoreSavedItemToCart,
  type CartLineItem,
} from "@/features/cart/lib/cart";
import { getSavedForLaterItems } from "@/features/cart/lib/saved-for-later";
import { reorderFromOrder } from "@/apps/website/lib/reorder";

/**
 * Three places put a stored line back in the cart, and each kept its own list
 * of what a line is made of.
 *
 * Undo-after-remove, Move-back-from-saved and Reorder-from-an-order all rebuilt
 * the line by naming every field. So every field added to a cart line had to be
 * remembered in three files, and the history says it was not: `photoUrl` was
 * missing from two of them, which did both halves of the damage at once — a
 * photo cake came back with nothing for the baker to print, and two lines
 * carrying two different children's photos collapsed into one of quantity 2,
 * because `cartLineId` folds the photo into a line's identity precisely so they
 * do not.
 *
 * The newest field, the shop's own word for the size axis, was missing from all
 * three. That one is worse than a drop: `addToCart`'s merge branch assigns
 * whatever it is handed, so putting a line back ERASED the label from the line
 * already sitting in the cart.
 *
 * These tests are written so that adding a field to `CartLineItem` and
 * forgetting the rebuild fails HERE, without anyone having to think of it: the
 * line goes out fully populated and must come back deep-equal.
 */

/** Every field a cart line can carry, all of them set to something distinctive. */
const FULL_LINE: CartLineItem = {
  id: "will-be-recomputed",
  productSlug: "cotton-tee",
  name: "Cotton Tee",
  image: "/tee.jpg",
  price: 849,
  quantity: 2,
  weight: "L",
  weightLabel: "Size",
  flavour: "Legacy flavour",
  shape: "Legacy shape",
  message: "For Ravi",
  photoUrl: "/uploads/ravi.jpg",
  deliveryDate: "2026-09-10",
  deliveryTime: "10:00-12:00",
  variantSelections: { "g-colour": "black" },
  variantSummary: ["Colour: Black"],
};

/** The stored line, minus the id the cart computes for itself. */
function withoutId(item: CartLineItem | undefined) {
  if (!item) return undefined;
  const { id: _id, ...rest } = item;
  return rest;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("one list of what a line is made of", () => {
  it("carries every field a line can hold", () => {
    addToCart(cartLineToAddInput(FULL_LINE));

    expect(withoutId(getCartItems()[0])).toEqual(withoutId(FULL_LINE));
  });

  it("lets the caller override just what it needs to", () => {
    // Reorder does exactly this: a line from an old order may name a photo the
    // shop has since replaced, so the catalogue's current one wins.
    addToCart(cartLineToAddInput(FULL_LINE, { image: "/fresh.jpg" }));

    expect(getCartItems()[0]?.image).toBe("/fresh.jpg");
    expect(getCartItems()[0]?.photoUrl).toBe("/uploads/ravi.jpg");
  });
});

describe("moving a line out and back", () => {
  it("brings the whole line back from saved for later", () => {
    addToCart(cartLineToAddInput(FULL_LINE));
    const lineId = getCartItems()[0]!.id;

    expect(moveCartItemToSavedForLater(lineId)).toBe(true);
    expect(getCartItems()).toHaveLength(0);

    const savedId = getSavedForLaterItems()[0]!.id;
    expect(restoreSavedItemToCart(savedId)).toBe(true);

    expect(withoutId(getCartItems()[0])).toEqual(withoutId(FULL_LINE));
  });

  it("does not erase the size wording off a line already in the cart", () => {
    /**
     * THE MERGE BRANCH. `addToCart` finds the existing line by `cartLineId` and
     * assigns the fields it was handed — so a rebuild that omits one does not
     * merely fail to restore it, it deletes it from the line that was there.
     * `weightLabel` is not part of the id, so the two lines merge and the
     * surviving one is whichever field list the rebuild had.
     */
    addToCart(cartLineToAddInput(FULL_LINE));
    const lineId = getCartItems()[0]!.id;
    moveCartItemToSavedForLater(lineId);
    // …and the customer adds the same thing again while it is saved.
    addToCart(cartLineToAddInput(FULL_LINE, { quantity: 1 }));

    const savedId = getSavedForLaterItems()[0]!.id;
    restoreSavedItemToCart(savedId);

    expect(getCartItems()).toHaveLength(1);
    expect(getCartItems()[0]?.weightLabel).toBe("Size");
    expect(getCartItems()[0]?.photoUrl).toBe("/uploads/ravi.jpg");
  });
});

describe("ordering the same thing again", () => {
  const ORDER = {
    orderNumber: "ORD-1",
    items: [FULL_LINE],
  } as never;

  it("puts back everything the customer chose the first time", () => {
    const result = reorderFromOrder(ORDER, [
      { slug: "cotton-tee", image: "/catalogue-tee.jpg", inStock: true },
    ]);

    expect(result.added).toBe(1);
    expect(withoutId(getCartItems()[0])).toEqual(withoutId(FULL_LINE));
  });

  it("uses the catalogue photo only when the stored one is gone", () => {
    reorderFromOrder({ orderNumber: "ORD-2", items: [{ ...FULL_LINE, image: "" }] } as never, [
      { slug: "cotton-tee", image: "/catalogue-tee.jpg", inStock: true },
    ]);

    expect(getCartItems()[0]?.image).toBe("/catalogue-tee.jpg");
    // …and the photo the customer uploaded is not the product photo, and must
    // survive either way.
    expect(getCartItems()[0]?.photoUrl).toBe("/uploads/ravi.jpg");
  });

  it("skips a line the shop no longer sells", () => {
    const result = reorderFromOrder(ORDER, [
      { slug: "cotton-tee", image: "/x.jpg", inStock: false },
    ]);

    expect(result.added).toBe(0);
    expect(result.unavailable).toEqual(["Cotton Tee"]);
    expect(getCartItems()).toHaveLength(0);
  });
});

describe("a saved line whose price the shop has since changed", () => {
  it("keeps the strike that belongs to the price it is putting back", () => {
    /**
     * The price override in `restoreSavedItemToCart` exists because a saved
     * line's price is stale — the cart's own is the less wrong of two. The
     * compare-at has to travel with it. Overriding the price alone put today's
     * price beside a month-old struck-through number, inventing a discount out
     * of two figures that were never quoted together — and if the shop had
     * dropped the offer entirely, one that no longer exists at all.
     */
    addToCart(cartLineToAddInput({ ...FULL_LINE, price: 1200, compareAtPrice: 1500 }));
    const lineId = getCartItems()[0]!.id;
    moveCartItemToSavedForLater(lineId);

    // The shop has since cut the price and withdrawn the offer, and the
    // customer has added the same thing again at today's terms.
    addToCart(cartLineToAddInput({ ...FULL_LINE, price: 900, compareAtPrice: undefined }));

    const savedId = getSavedForLaterItems()[0]!.id;
    restoreSavedItemToCart(savedId);

    expect(getCartItems()[0]?.price).toBe(900);
    expect(getCartItems()[0]?.compareAtPrice).toBeUndefined();
  });

  it("keeps the saved line's own strike when it is not already in the cart", () => {
    addToCart(cartLineToAddInput({ ...FULL_LINE, price: 1200, compareAtPrice: 1500 }));
    moveCartItemToSavedForLater(getCartItems()[0]!.id);

    restoreSavedItemToCart(getSavedForLaterItems()[0]!.id);

    expect(getCartItems()[0]?.price).toBe(1200);
    expect(getCartItems()[0]?.compareAtPrice).toBe(1500);
  });
});
