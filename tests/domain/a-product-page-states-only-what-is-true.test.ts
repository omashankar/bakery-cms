import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A phone charger's page said it serves 8–10 people.
 *
 * `getProductWeightOptions` and `getProductShapeOptions` were changed to return
 * `[]` for a product that declares no tiers and no shapes — which is the whole
 * point of a catalogue that is not a bakery. But the page was left as it was,
 * and before that change neither list could BE empty: the weight one fell back
 * through the shop's catalog presets, the shape one to Round/Square/Heart. So
 * the page's empty cases were dead code, and the change made them the default:
 *
 *   - a "Weight" heading over no buttons
 *   - a "Shape" heading over no buttons
 *   - and, gated by nothing at all, "Serves 8–10 people · 1 kg" printed under
 *     the price as a statement of fact
 *
 * The 29 products already in this shop all carry weights and shapes, so none of
 * them hit it. The FIRST product created after that change does, and so does any
 * cake whose owner presses the new "Sold in one size" button.
 *
 * There is no other React-render test of this page in the suite, which is why
 * the regression shipped. Reading the source could not have caught it: every
 * individual expression was correct, and the defect was that a fallback stopped
 * being unreachable.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/store/cakes/x",
  useSearchParams: () => new URLSearchParams(),
}));

// The page fetches approved reviews on mount; the network is not under test.
vi.mock("@/features/reviews/lib/reviews-api", () => ({
  fetchApprovedReviews: async () => [],
  submitReview: async () => ({ ok: true }),
}));

const { ProductDetailPage } = await import("@/apps/website/pages/product-detail-page");

type Product = Record<string, unknown>;

/** A product with nothing bakery about it: no tiers, no shapes, no flavours. */
const CHARGER: Product = {
  id: "p-charger",
  name: "65W Type-C Charger",
  slug: "type-c-charger",
  description: "Fast charging for phones and laptops.",
  price: 1499,
  image: "/charger.jpg",
  category: "Chargers",
  inStock: true,
  weights: [],
  shapes: [],
  flavours: [],
  variantGroups: [
    {
      id: "g-storage",
      name: "Cable length",
      type: "custom",
      options: [
        { id: "o-1m", label: "1 m", priceAdjustment: 0, isDefault: true },
        { id: "o-2m", label: "2 m", priceAdjustment: 200 },
      ],
    },
  ],
};

/** A cake as this shop actually stores one. */
const CAKE: Product = {
  id: "p-bf",
  name: "Black Forest",
  slug: "black-forest",
  description: "Cherries and cream.",
  price: 999,
  image: "/bf.jpg",
  category: "Cakes",
  inStock: true,
  weights: [
    { label: "1 kg", price: 999, serves: "8–10" },
    { label: "2 kg", price: 1799, serves: "16–20" },
  ],
  shapes: ["Round", "Heart"],
  flavours: ["Chocolate", "Vanilla"],
  variantGroups: [],
};

function render(cake: Product): { html: string; unmount: () => void } {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ProductDetailPage, { cake, related: [], catalog: [] } as never));
  });

  return {
    html: container.innerHTML,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("a product that is sold one way says so by saying nothing", () => {
  it("does not claim a charger serves 8–10 people or weighs 1 kg", () => {
    const { html, unmount } = render(CHARGER);
    try {
      // The regression, exactly. Both strings came from `?? "8–10"` and
      // `?? "1 kg"` in a line no module and no length check guarded.
      expect(html).not.toContain("Serves");
      expect(html).not.toContain("1 kg");
    } finally {
      unmount();
    }
  });

  it("renders no Weight heading and no Shape heading when there is nothing to choose", () => {
    const { html, unmount } = render(CHARGER);
    try {
      // A heading over an empty list. `modules.weight` and `modules.shape`
      // default ON and are shop-wide, so a shop selling cakes AND chargers
      // cannot switch these off — the guard has to come from the product.
      expect(html).not.toContain(">Weight<");
      expect(html).not.toContain(">Shape<");
      expect(html).not.toContain(">Flavour<");
    } finally {
      unmount();
    }
  });

  it("still renders the option the shop DID configure", () => {
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).toContain("Cable length");
      expect(html).toContain("2 m");
    } finally {
      unmount();
    }
  });
});

describe("a cake still says everything it used to", () => {
  it("prints its own tier under the price, not a fallback", () => {
    const { html, unmount } = render(CAKE);
    try {
      expect(html).toContain("Serves 8–10 people");
      expect(html).toContain("1 kg");
    } finally {
      unmount();
    }
  });

  it("renders the Weight, Shape and Flavour choices it actually offers", () => {
    const { html, unmount } = render(CAKE);
    try {
      expect(html).toContain(">Weight<");
      expect(html).toContain(">Shape<");
      expect(html).toContain(">Flavour<");
      expect(html).toContain("2 kg");
      expect(html).toContain("Heart");
      expect(html).toContain("Vanilla");
    } finally {
      unmount();
    }
  });
});
