import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two ways a cart line ends up describing something the customer did not order.
 *
 * The first is "Order again". `cartLineId` folds the photo, the message and the
 * shape into the line's identity precisely so that two photo cakes with two
 * different children's photos stay two lines — the comment on it records the
 * bug where "the baker made the same cake twice". But `reorderFromOrder` passed
 * `message` and `shape` and NOT `photoUrl`, so a reorder both lost the photo
 * and re-collapsed the two lines it was written to keep apart. The +250 photo
 * surcharge was still on the price, because that came off the stored line.
 *
 * The second is the grid. A card's Add button sent slug, name, image, price and
 * quantity — no `variantSelections` — so the cart showed a line with no options
 * while the server, which falls back to each group's default option, priced and
 * recorded "Storage: 128 GB". The customer was never shown a choice and one was
 * recorded against their name.
 *
 * THE CARD HALF IS RENDERED, not asserted through its predicate. The first
 * version of this file called `productHasOptions` three times and never mounted
 * the component, never touched the cart on that path, and never checked a
 * navigation — so deleting the guard in ProductCard, or the field from `toCard`,
 * left the whole suite green. A one-line predicate is not the behaviour.
 */

const state = vi.hoisted(() => ({ pushed: [] as string[] }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => {
      state.pushed.push(href);
    },
    replace: () => undefined,
    refresh: () => undefined,
  }),
  usePathname: () => "/store/collections",
}));

const { addToCart, cartLineId, clearCart, getCartItems } = await import(
  "@/features/cart/lib/cart"
);
const { reorderFromOrder } = await import("@/apps/website/lib/reorder");
const { ProductCard } = await import("@/components/storefront/product-card");
const { routes } = await import("@/constants/routes");

type LandingProduct = Record<string, unknown>;
type PlacedOrder = Record<string, unknown>;

beforeEach(() => {
  localStorage.clear();
  clearCart();
  state.pushed = [];
  document.body.innerHTML = "";
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
    reorderFromOrder(order as never, CATALOGUE as never);

    const photos = getCartItems().map((item) => item.photoUrl);
    // Dropped entirely today: the surcharge is on the price, the photo is not.
    expect(photos).toContain("https://cdn.test/aarav.jpg");
    expect(photos).toContain("https://cdn.test/isha.jpg");
  });

  it("does not merge two different photo cakes into one line of quantity 2", () => {
    const result = reorderFromOrder(order as never, CATALOGUE as never);

    expect(result.added).toBe(2);
    expect(getCartItems()).toHaveLength(2);
    expect(getCartItems().every((item) => item.quantity === 1)).toBe(true);
  });

  it("gives the two lines different ids, which is what keeps them apart", () => {
    const items = (order as { items: Parameters<typeof cartLineId>[0][] }).items;
    expect(cartLineId(items[0])).not.toBe(cartLineId(items[1]));
  });
});


/** A configurable product, with the shop's own resolution of its defaults. */
const CHARGER: LandingProduct = {
  id: "p-charger",
  name: "65W Charger",
  slug: "type-c-charger",
  description: "",
  price: 1499,
  image: "/charger.jpg",
  category: "Chargers",
  inStock: true,
};

const BUN: LandingProduct = {
  id: "p-bun",
  name: "Plain Bun",
  slug: "plain-bun",
  description: "",
  price: 40,
  image: "/bun.jpg",
  category: "Bakes",
  inStock: true,
};

describe("a card does not add to the cart at all now", () => {
  /*
    THE BUTTON WENT, at the shop's request — the card is a link and the
    product page is where the selling happens.

    So this stops describing what a card add committed to and pins that
    there is no card add. RENDERED and not asserted through the source,
    for the reason this file's own note at the top gives: the first version
    of these cases called a predicate three times, never mounted the
    component, and left the suite green when the guard inside ProductCard
    was deleted.
  */
  it("renders no control that would add one, and touches no cart line", () => {
    clearCart();

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    act(() => {
      root.render(createElement(ProductCard, { cake: CHARGER } as never));
    });

    const buttons = [...container.querySelectorAll("button")];
    expect(
      buttons.map((b) => b.textContent ?? "").join(" | "),
      "a card offers to add to the cart again",
    ).not.toMatch(/add to cart/i);

    /*
      AND PRESSING WHAT IS LEFT DOES NOT BUY ANYTHING. The wishlist heart is
      still there; a guard that only reads the words would pass if that
      button quietly started adding to the cart.
    */
    for (const button of buttons) {
      act(() => {
        button.click();
      });
    }
    expect(getCartItems(), "pressing a card put something in the cart").toHaveLength(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});

describe("addToCart itself is untouched by the card's decision", () => {
  it("still adds what it is handed", () => {
    // The guard lives in the card, not in the cart — a caller that has already
    // resolved the customer's choices (the product page) must not be blocked.
    addToCart({
      productSlug: "type-c-charger",
      name: "65W Charger",
      image: "",
      price: 6499,
      quantity: 1,
      variantSelections: { "g-storage": "o-256" },
      variantSummary: ["Storage: 256 GB"],
    });

    expect(getCartItems()).toHaveLength(1);
    expect(getCartItems()[0].variantSummary).toEqual(["Storage: 256 GB"]);
  });
});
