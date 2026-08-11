/**
 * Saving a cake for later, and putting it back.
 *
 * `addSavedForLaterItem` stored a row as `saved-<cart id>` and looked for an
 * existing row under `<cart id>` — an id no stored row ever carries. So its
 * merge branch was unreachable, and saving the same line twice wrote a SECOND
 * row under the same id. Both are then matched by id, so removing one removed
 * both, and restoring one destroyed the other.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  addSavedForLaterItem,
  getSavedForLaterItems,
  removeSavedForLaterItem,
  savedIdFor,
} from "@/features/cart/lib/saved-for-later";
import {
  addToCart,
  cartLineId,
  getCartItems,
  moveCartItemToSavedForLater,
  restoreSavedItemToCart,
} from "@/features/cart/lib/cart";

const line = {
  productSlug: "black-forest",
  name: "Black Forest",
  image: "",
  price: 750,
  quantity: 1,
};

beforeEach(() => {
  localStorage.clear();
});

describe("saving the same cake for later twice", () => {
  it("keeps one row, with both units on it", () => {
    const added = addToCart(line);

    addSavedForLaterItem(added);
    addSavedForLaterItem({ ...added, quantity: 2 });

    const saved = getSavedForLaterItems();
    expect(saved, "a second save wrote a duplicate row").toHaveLength(1);
    expect(saved[0].quantity).toBe(3);
  });

  it("does not WRITE a duplicate in the first place", () => {
    const added = addToCart(line);

    addSavedForLaterItem(added);
    addSavedForLaterItem({ ...added, quantity: 2 });

    /**
     * Asserted against storage, not against the reader.
     *
     * `readSavedItems` merges duplicate ids to heal browsers already holding
     * them, and that merge hides a broken write completely: with the id lookup
     * reverted, two rows go into storage and one comes back out. Both halves
     * have to be pinned, or removing the heal later silently restores the bug.
     */
    const stored = JSON.parse(localStorage.getItem("bakery-cms-saved-for-later") ?? "[]");
    expect(stored, "two rows went into storage under the same id").toHaveLength(1);
  });

  it("does not lose the other row when one is removed", () => {
    const first = addToCart(line);
    const second = addToCart({ ...line, productSlug: "red-velvet", name: "Red Velvet" });

    addSavedForLaterItem(first);
    addSavedForLaterItem(second);
    expect(getSavedForLaterItems()).toHaveLength(2);

    removeSavedForLaterItem(savedIdFor(first.id));

    const left = getSavedForLaterItems();
    expect(left, "removing one saved row took the other with it").toHaveLength(1);
    expect(left[0].productSlug).toBe("red-velvet");
  });

  it("heals duplicates a browser is already holding", () => {
    // Written by the old code. These are already in customers' browsers, and
    // both would still be destroyed together by one remove.
    localStorage.setItem(
      "bakery-cms-saved-for-later",
      JSON.stringify([
        { ...line, id: "saved-black-forest-default-default-default", quantity: 1 },
        { ...line, id: "saved-black-forest-default-default-default", quantity: 2 },
      ]),
    );

    const saved = getSavedForLaterItems();
    expect(saved).toHaveLength(1);
    expect(saved[0].quantity).toBe(3);
  });
});

describe("restoring a saved cake into a cart that already has it", () => {
  it("does not roll the price back to whatever it was when it was saved", () => {
    // Saved at 750.
    const added = addToCart(line);
    moveCartItemToSavedForLater(added.id);
    expect(getCartItems()).toHaveLength(0);

    // The shop's price has moved on, and the customer adds one at today's price.
    addToCart({ ...line, price: 900 });
    expect(getCartItems()[0].price).toBe(900);

    restoreSavedItemToCart(savedIdFor(added.id));

    const cart = getCartItems();
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
    expect(
      cart[0].price,
      "restoring an old saved item rewrote the price of units already in the cart",
    ).toBe(900);
  });

  it("keeps the saved price when the cake is not in the cart at all", () => {
    // Nothing to disagree with, so the saved copy is the only answer available.
    const added = addToCart(line);
    moveCartItemToSavedForLater(added.id);

    restoreSavedItemToCart(savedIdFor(added.id));

    expect(getCartItems()[0].price).toBe(750);
  });

  it("takes the saved row away once, not the whole list", () => {
    const first = addToCart(line);
    const second = addToCart({ ...line, productSlug: "red-velvet", name: "Red Velvet" });
    moveCartItemToSavedForLater(first.id);
    moveCartItemToSavedForLater(second.id);

    restoreSavedItemToCart(savedIdFor(first.id));

    const saved = getSavedForLaterItems();
    expect(saved).toHaveLength(1);
    expect(saved[0].productSlug).toBe("red-velvet");
  });
});

describe("the cart line id", () => {
  it("is the same one addToCart uses, so callers can find a line before adding", () => {
    const added = addToCart(line);

    expect(cartLineId(line)).toBe(added.id);
  });

  it("separates the same cake in different sizes", () => {
    expect(cartLineId({ ...line, weight: "1 kg" })).not.toBe(cartLineId({ ...line, weight: "2 kg" }));
  });
});
