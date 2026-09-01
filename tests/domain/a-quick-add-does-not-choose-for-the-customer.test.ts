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

/** Mount a card and hand back its Add button. */
function renderCard(cake: LandingProduct): { button: HTMLButtonElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ProductCard, { cake } as never));
  });

  const buttons = [...container.querySelectorAll("button")] as HTMLButtonElement[];
  const button = buttons.find((element) =>
    /Add to Cart|Choose options|Out of stock/i.test(element.textContent ?? ""),
  );
  if (!button) throw new Error("no add button rendered");

  return {
    button,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const CHARGER: LandingProduct = {
  id: "p-charger",
  name: "65W Charger",
  slug: "type-c-charger",
  description: "",
  price: 1499,
  image: "/charger.jpg",
  category: "Chargers",
  inStock: true,
  hasOptions: true,
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
  hasOptions: false,
};

describe("a card add never records a choice the customer was not shown", () => {
  it("sends a product with options to its page instead of adding it", () => {
    const { button, unmount } = renderCard(CHARGER);
    try {
      expect(button.textContent).toContain("Choose options");

      act(() => {
        button.click();
      });

      // The card cannot present a picker, and the server falls back to each
      // group's default — so a silent add is priced AND recorded as a choice.
      expect(getCartItems()).toHaveLength(0);
      expect(state.pushed).toEqual([routes.store.cake("type-c-charger")]);
    } finally {
      unmount();
    }
  });

  it("keeps the one-tap add for a product with nothing to choose", () => {
    const { button, unmount } = renderCard(BUN);
    try {
      expect(button.textContent).toContain("Add to Cart");

      act(() => {
        button.click();
      });

      expect(state.pushed).toEqual([]);
      expect(getCartItems()).toHaveLength(1);
      expect(getCartItems()[0].productSlug).toBe("plain-bun");
    } finally {
      unmount();
    }
  });

  it("still refuses an out-of-stock product before either path", () => {
    const { button, unmount } = renderCard({ ...CHARGER, inStock: false });
    try {
      expect(button.disabled).toBe(true);
      expect(button.textContent).toContain("Out of stock");

      act(() => {
        button.click();
      });

      expect(getCartItems()).toHaveLength(0);
      expect(state.pushed).toEqual([]);
    } finally {
      unmount();
    }
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
