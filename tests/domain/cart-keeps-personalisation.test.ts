import { beforeEach, describe, expect, it } from "vitest";

import { addToCart, cartLineId, clearCart, getCartItems } from "@/features/cart/lib/cart";

/**
 * Two differently personalised cakes are two cart lines.
 *
 * `cartLineId` keyed on the cake, the weight, the flavour and the variant
 * options — and nothing else. Shape, message and the uploaded photo were not in
 * it, so two adds differing only in those collapsed onto one line, and
 * `addToCart`'s merge branch then overwrote `message` and `photoUrl` with the
 * second add's values while adding the quantities.
 *
 * A customer ordering two photo cakes, one photo per child, got one line for
 * two cakes carrying one photo — and the baker made the same cake twice. A
 * heart for one person and a round for another lost the heart entirely.
 */

const base = {
  productSlug: "chocolate-truffle",
  name: "Chocolate Truffle",
  image: "/cake.jpg",
  price: 900,
  quantity: 1,
  weight: "1 kg",
  flavour: "Chocolate",
};

beforeEach(() => {
  localStorage.clear();
  clearCart();
});

describe("two adds of the same cake", () => {
  it("stay apart when the message differs", () => {
    addToCart({ ...base, message: "Happy Birthday Aarav" });
    addToCart({ ...base, message: "Happy Birthday Diya" });

    const items = getCartItems();
    expect(items, "the two messages were merged into one line").toHaveLength(2);
    expect(items.map((item) => item.message).sort()).toEqual([
      "Happy Birthday Aarav",
      "Happy Birthday Diya",
    ]);
    expect(items.every((item) => item.quantity === 1)).toBe(true);
  });

  it("stay apart when the photo differs", () => {
    addToCart({ ...base, photoUrl: "/uploads/aarav.jpg" });
    addToCart({ ...base, photoUrl: "/uploads/diya.jpg" });

    const items = getCartItems();
    expect(items, "one photo replaced the other").toHaveLength(2);
    expect(items.map((item) => item.photoUrl).sort()).toEqual([
      "/uploads/aarav.jpg",
      "/uploads/diya.jpg",
    ]);
  });

  it("stay apart when the shape differs", () => {
    addToCart({ ...base, shape: "Heart" });
    addToCart({ ...base, shape: "Round" });

    const items = getCartItems();
    expect(items, "the second shape was dropped").toHaveLength(2);
    expect(items.map((item) => item.shape).sort()).toEqual(["Heart", "Round"]);
  });

  it("still merge when the personalisation is identical", () => {
    // The other half: adding the same cake twice must still be one line of two,
    // or the cart fills with duplicates for every repeat click.
    addToCart({ ...base, message: "Happy Birthday" });
    addToCart({ ...base, message: "Happy Birthday" });

    const items = getCartItems();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("still merge when neither carries any personalisation", () => {
    addToCart({ ...base });
    addToCart({ ...base });

    expect(getCartItems()).toHaveLength(1);
    expect(getCartItems()[0].quantity).toBe(2);
  });
});

describe("the line id", () => {
  it("is the one the cart actually stored, so a saved item can find its line", () => {
    // `restoreSavedItemToCart` computes this id to decide whether the line is
    // already in the cart and whose price wins.
    const line = { ...base, message: "For Diya", photoUrl: "/uploads/diya.jpg" };
    const added = addToCart(line);

    expect(cartLineId(line)).toBe(added.id);
  });

  it("separates personalisations without letting a long message bloat it", () => {
    const long = "x".repeat(2000);
    const id = cartLineId({ ...base, message: long });

    expect(id.length).toBeLessThan(120);
    expect(id).not.toBe(cartLineId({ ...base, message: `${long}y` }));
  });
});
