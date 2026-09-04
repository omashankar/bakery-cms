import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  addToCart,
  cartLineToAddInput,
  getCartItems,
  type CartLineItem,
} from "@/features/cart/lib/cart";

/**
 * A cart line said what it cost and almost nothing else.
 *
 * It showed the image, the name, the options and one number. Not what the shop
 * says the thing normally costs; not what ONE of them costs when the customer
 * has four; not the photo they uploaded for it to be printed on, which the line
 * has carried since photo uploads shipped and no screen before the invoice ever
 * showed back; not whether the shop can still sell it; and no way to change any
 * choice except by removing the line and starting again.
 *
 * The struck-through price is the delicate one. `compareAtPrice` is stamped on
 * the LINE when it is added, because the cart holds lines rather than products
 * and the catalogue it is handed carries a price already shifted by every
 * default option — recomputing here would strike a different number from the one
 * the customer was shown a click earlier. And it is absent unless the shop typed
 * one: a struck-through number is a claim about the past that only the shop can
 * make.
 */

const pushed: string[] = [];
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: (href: string) => pushed.push(href),
    replace: () => undefined,
    refresh: () => undefined,
  }),
  usePathname: () => "/store/cart",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/reviews/lib/reviews-api", () => ({
  fetchApprovedReviews: async () => [],
  submitReview: async () => ({ ok: true }),
}));

const { CartPage } = await import("@/apps/website/pages/cart-page");
const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");

const LINE: CartLineItem = {
  id: "seed",
  productSlug: "cotton-tee",
  name: "Cotton Tee",
  image: "/tee.jpg",
  price: 800,
  quantity: 1,
  weight: "M",
  weightLabel: "Size",
  variantSelections: { "g-colour": "black" },
  variantSummary: ["Colour: Black"],
};

/** The same product, as the storefront sees it. */
const PRODUCT = {
  id: "p-tee",
  name: "Cotton Tee",
  slug: "cotton-tee",
  description: "Soft cotton.",
  price: 800,
  image: "/tee.jpg",
  category: "Shirts",
  inStock: true,
  weights: [
    { label: "M", price: 800 },
    { label: "L", price: 900 },
  ],
  weightLabel: "Size",
  shapes: [],
  variantGroups: [
    {
      id: "g-colour",
      name: "Colour",
      type: "custom",
      options: [
        { id: "black", label: "Black", priceAdjustment: 0, isDefault: true },
        { id: "white", label: "White", priceAdjustment: 0 },
      ],
    },
  ],
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function mount(element: ReturnType<typeof createElement>) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(element);
  });
  return container;
}

function renderCart(catalog: unknown[] = []) {
  return mount(createElement(CartPage, { catalog } as never));
}

function click(element: Element | null | undefined) {
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

function buttonSaying(text: string) {
  return [...(container?.querySelectorAll("button") ?? [])].find((node) =>
    (node.textContent ?? "").includes(text),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  pushed.length = 0;
});

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
});

describe("what a line says it costs", () => {
  it("strikes through the price the shop says it normally is", () => {
    addToCart(cartLineToAddInput({ ...LINE, compareAtPrice: 1000, quantity: 2 }));

    const text = renderCart().textContent ?? "";
    // Struck at the LINE total, beside the line total — 2 x 1,000 against 2 x 800.
    expect(text).toContain("₹2,000");
    expect(text).toContain("₹1,600");
    expect(text).toContain("20% off");
  });

  it("claims no discount for a shop that never stated one", () => {
    /**
     * The repository's own rule, from the day an invented MRP was removed from
     * it: every demo product over ₹1,000 wore a permanent "9% OFF" against a
     * price nobody had ever charged.
     */
    addToCart(cartLineToAddInput(LINE));

    expect(renderCart().textContent ?? "").not.toContain("% off");
  });

  it("says what one of them costs when there are several", () => {
    addToCart(cartLineToAddInput({ ...LINE, quantity: 3 }));

    expect(renderCart().textContent ?? "").toContain("₹800 each");
  });

  it("says nothing about one of them when there is one", () => {
    addToCart(cartLineToAddInput(LINE));

    expect(renderCart().textContent ?? "").not.toContain("each");
  });
});

describe("what else the line is carrying", () => {
  it("shows the photo the customer uploaded for it", () => {
    addToCart(cartLineToAddInput({ ...LINE, photoUrl: "/uploads/ravi.jpg" }));

    const view = renderCart();
    const photo = [...view.querySelectorAll("img")].find((image) =>
      (image.getAttribute("src") ?? "").includes("/uploads/ravi.jpg"),
    );
    expect(photo, "the uploaded photo is never shown back before the invoice").toBeTruthy();
  });

  it("says when the shop can no longer sell it", () => {
    addToCart(cartLineToAddInput(LINE));

    const view = renderCart([{ ...PRODUCT, inStock: false }]);
    expect(view.textContent ?? "").toContain("out of stock");
  });

  it("does not condemn every line when it was told nothing", () => {
    /**
     * The catalogue prop defaults to an empty array. Validating against it
     * would answer "nothing you have is available" for a cart that is
     * perfectly fine — and the customer would be told to remove everything.
     */
    addToCart(cartLineToAddInput(LINE));

    const text = renderCart([]).textContent ?? "";
    expect(text).not.toContain("no longer available");
    expect(text).not.toContain("out of stock");
  });
});

describe("changing a choice on a line already in the cart", () => {
  it("offers a way back to the product page for that exact line", () => {
    addToCart(cartLineToAddInput(LINE));
    const lineId = getCartItems()[0]!.id;

    const view = renderCart();
    const edit = [...view.querySelectorAll("a")].find((anchor) =>
      (anchor.getAttribute("href") ?? "").includes("line="),
    );

    expect(edit?.getAttribute("href")).toContain("/cotton-tee");
    expect(edit?.getAttribute("href")).toContain(`line=${encodeURIComponent(lineId)}`);
  });

  it("reopens the product with the choices already made", () => {
    addToCart(cartLineToAddInput({ ...LINE, weight: "L", price: 900, quantity: 3 }));
    const lineId = getCartItems()[0]!.id;

    const view = mount(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: lineId,
      } as never),
    );

    // The size the customer picked, not the first tier; and their quantity.
    expect(view.textContent).toContain("Update cart");
    const chosen = [...view.querySelectorAll("button")].find(
      (node) => node.textContent?.trim() === "L",
    );
    expect(chosen?.className).toContain("bg-bakery-700");
  });

  it("keeps the line when the edit changed nothing it is identified by", () => {
    /**
     * THE CASE THAT EMPTIED THE CART.
     *
     * `cartLineId` keys on the size, the options, the message and the photo. It
     * does NOT key on quantity or the delivery date — so pressing Edit and
     * changing only the quantity, or changing nothing at all, produces the SAME
     * id. `addToCart` then merges into the very line being edited, and removing
     * "the old line" afterwards deleted it. The customer was redirected to a
     * cart with the item gone, under a "Cart updated" toast.
     *
     * The test beside this one changes the SIZE, which is the one branch where
     * removing unconditionally is correct — so it passed throughout.
     */
    addToCart(cartLineToAddInput({ ...LINE, weight: "M", price: 800, quantity: 2 }));
    const lineId = getCartItems()[0]!.id;

    mount(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: lineId,
      } as never),
    );

    // Change nothing at all, and commit.
    click(buttonSaying("Update cart"));

    const cart = getCartItems();
    expect(cart, "the line the customer was editing was deleted").toHaveLength(1);
    expect(cart[0]?.weight).toBe("M");
    // …and the quantity is the one on screen, not that plus the one already
    // there: the merge branch adds, and this line is its own replacement.
    expect(cart[0]?.quantity).toBe(2);
  });

  it("keeps the line when only the quantity changed", () => {
    addToCart(cartLineToAddInput({ ...LINE, weight: "M", price: 800, quantity: 2 }));
    const lineId = getCartItems()[0]!.id;

    mount(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: lineId,
      } as never),
    );

    // The stepper labels its buttons rather than writing on them.
    click(container!.querySelector('button[aria-label="Increase quantity"]'));
    click(buttonSaying("Update cart"));

    const cart = getCartItems();
    expect(cart).toHaveLength(1);
    expect(cart[0]?.quantity).toBe(3);
  });

  it("replaces the line instead of leaving a second one beside it", () => {
    /**
     * `cartLineId` folds the size and the options into a line's identity, so
     * changing one necessarily makes a DIFFERENT line. Adding without removing
     * would leave the customer holding both.
     */
    addToCart(cartLineToAddInput({ ...LINE, weight: "M", price: 800 }));
    const lineId = getCartItems()[0]!.id;

    mount(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: lineId,
      } as never),
    );

    // Pick the other size, then commit.
    click([...container!.querySelectorAll("button")].find((node) => node.textContent?.trim() === "L"));
    click(buttonSaying("Update cart"));

    const cart = getCartItems();
    expect(cart).toHaveLength(1);
    expect(cart[0]?.weight).toBe("L");
    // …and it takes the customer back where they pressed Edit.
    expect(pushed).toContain("/store/cart");
  });

  it("leaves the cart alone when the line is not there any more", () => {
    // Two tabs: the line was removed in the other one before this page loaded.
    addToCart(cartLineToAddInput(LINE));

    const view = mount(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: "a-line-that-is-gone",
      } as never),
    );

    expect(view.textContent).toContain("Add to Cart");
    expect(view.textContent).not.toContain("Update cart");
  });
});

describe("a line id that names something else", () => {
  it("will not edit another product's line", () => {
    /**
     * `?line=` is a URL, so it is whatever anybody types. Without the check
     * that the line belongs to THIS product, opening
     * /store/cakes/cotton-tee?line=<a cake line> restored the cake's options
     * onto the shirt's page — and committing would have deleted the cake from
     * the cart while adding a shirt.
     */
    addToCart(
      cartLineToAddInput({
        ...LINE,
        productSlug: "black-forest",
        name: "Black Forest",
        weight: "1 kg",
      }),
    );
    const otherLineId = getCartItems()[0]!.id;

    const view = mount(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: otherLineId,
      } as never),
    );

    expect(view.textContent).toContain("Add to Cart");
    expect(view.textContent).not.toContain("Update cart");

    click(buttonSaying("Add to Cart"));

    // The other product's line is still there, untouched.
    expect(getCartItems().some((item) => item.productSlug === "black-forest")).toBe(true);
  });
});

describe("editing a line made before shapes were a variant group", () => {
  it("shows the shape the customer actually chose, not the group's default", () => {
    /**
     * `shapes: string[]` was an unpriced list of names with its own hard-coded
     * picker; it is a typed variant group now. Lines carrying the old flat
     * field still arrive — carts have no expiry — and the server maps them onto
     * the matching option and charges for it. Restoring without the same
     * mapping showed the DEFAULT, so a customer opening their Heart cake to fix
     * the message saw Round, and committing quietly changed what gets baked.
     */
    const CAKE = {
      ...PRODUCT,
      slug: "black-forest",
      name: "Black Forest",
      weights: [{ label: "1 kg", price: 800 }],
      variantGroups: [
        {
          id: "g-shape",
          name: "Shape",
          type: "shape",
          options: [
            { id: "round", label: "Round", priceAdjustment: 0, isDefault: true },
            { id: "heart", label: "Heart", priceAdjustment: 150 },
          ],
        },
      ],
    };

    addToCart(
      cartLineToAddInput({
        ...LINE,
        productSlug: "black-forest",
        name: "Black Forest",
        weight: "1 kg",
        // The old flat field, and no selection — which is exactly what a line
        // from before the change looks like.
        shape: "Heart",
        variantSelections: undefined,
        variantSummary: undefined,
      }),
    );
    const lineId = getCartItems()[0]!.id;

    mount(
      createElement(ProductDetailPage, {
        cake: CAKE,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        editLineId: lineId,
      } as never),
    );

    click(buttonSaying("Update cart"));

    expect(getCartItems()[0]?.variantSelections?.["g-shape"]).toBe("heart");
  });
});
