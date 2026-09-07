import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";

/**
 * Two things the product page did that the final structure does not want.
 *
 * IT ASKED TWICE. "Add to Cart" and "Buy Now" sat side by side in the loudest
 * place on the page, doing the same thing — the second added the identical line
 * and then navigated. Two primary buttons make a customer choose between them
 * before they can do the one thing they came for, and the difference was a
 * navigation they can make themselves.
 *
 * IT HID THE ONE RAIL A CRAWLER COULD HAVE HAD. "You May Also Like" is built
 * from a SERVER prop, and it was gated behind a mount flag left over from when
 * both rails merged a localStorage catalogue. So the related products were
 * absent from the initial HTML of the route whose per-product metadata exists
 * precisely to be read. The recommended rail keeps the gate, because it ranks by
 * recently-viewed and past orders, which live in this browser and nowhere else.
 *
 * And it never showed the "Barcode / SKU" the admin form has always taken — a
 * field an owner fills in and never sees again.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/store/cakes/x",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/reviews/lib/reviews-api", () => ({
  fetchApprovedReviews: async () => [],
  submitReview: async () => ({ ok: true }),
}));

const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");

const PRODUCT = {
  id: "p-1",
  name: "Cotton Tee",
  slug: "cotton-tee",
  description: "Soft cotton.",
  price: 800,
  image: "/tee.jpg",
  category: "Shirts",
  inStock: true,
  weights: [],
  shapes: [],
  variantGroups: [],
};

const RELATED = [
  {
    id: "p-2",
    name: "Linen Shirt",
    slug: "linen-shirt",
    price: 1200,
    image: "/linen.jpg",
    category: "Shirts",
    inStock: true,
  },
];

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

/**
 * Rendered WITHOUT flushing effects, which is the whole point for the rail:
 * this is what the server sends and what a crawler reads. `act` still runs the
 * mount effects, so the assertion is on the markup captured before any of them
 * could have changed it.
 */
function render(props: Record<string, unknown> = {}) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
        ...props,
      } as never),
    );
  });
  return container;
}

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

describe("one way to buy", () => {
  it("offers a single primary action", () => {
    const text = render().textContent ?? "";

    expect(text).toContain("Add to Cart");
    expect(text).not.toContain("Buy Now");
  });

  it("still offers it in the bar that follows a phone down the page", () => {
    const bar = render().querySelector(".fixed.inset-x-0.bottom-0");

    expect(bar?.textContent).toContain("Add to Cart");
    expect(bar?.textContent).not.toContain("Buy Now");
  });
});

describe("the rail built from what the server sent", () => {
  it("is in the markup the SERVER sends, before any effect runs", () => {
    /**
     * Rendered to a string, which is what a crawler and the first paint get.
     * Asserting on a mounted DOM proves nothing here:  flushes the mount
     * effect, so a rail gated behind it looks present either way — which is
     * exactly how the gate survived unnoticed in the first place.
     */
    const html = renderToStaticMarkup(
      createElement(ProductDetailPage, {
        cake: PRODUCT,
        modules: defaultModuleSettings,
        related: RELATED,
        catalog: [],
      } as never),
    );

    expect(html).toContain("You May Also Like");
    expect(html).toContain("Linen Shirt");
  });

  it("is absent when the shop has nothing to put in it", () => {
    expect(render().textContent).not.toContain("You May Also Like");
  });
});

describe("the field the admin filled in and never saw again", () => {
  /**
   * Barcode / SKU was taken by the product form for as long as the form had
   * existed and rendered nowhere, so this file gave it two places to show:
   * a chip beside the name and a line at the foot of the page. Which turned
   * out to be one place too many — it printed twice.
   *
   * The shop has now removed the field itself, along with Preparation time,
   * Shelf life, Calories, Ingredients and Allergens. So the answer to “where
   * does the SKU show” is nowhere, and that is what this asserts.
   */

  it("is not on the product page, because it is not on the product", () => {
    // Passed anyway: `LandingProduct` no longer declares it, and a stored
    // document that still carries one must not find its way back to a customer.
    const text = render({ cake: { ...PRODUCT, barcode: "SKU-42" } }).textContent ?? "";

    expect(text).not.toContain("SKU-42");
    expect(text).not.toContain("SKU");
  });
});
