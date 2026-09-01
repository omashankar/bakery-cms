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

function render(cake: Product): {
  html: string;
  /**
   * Open a tab by its label and hand back the markup that follows.
   *
   * Radix mounts only the ACTIVE tab's content, so asserting on a tab's text
   * without opening it passes for a product that has no such tab at all. A
   * first version of these tests did exactly that.
   */
  openTab: (label: string) => string;
  unmount: () => void;
} {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(createElement(ProductDetailPage, { cake, related: [], catalog: [] } as never));
  });

  return {
    html: container.innerHTML,
    openTab: (label: string) => {
      const trigger = [...container.querySelectorAll("button")].find(
        (element) => element.textContent?.trim() === label,
      );
      if (!trigger) throw new Error(`no "${label}" tab to open`);
      act(() => {
        trigger.click();
      });
      return container.innerHTML;
    },
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

describe("the shop's own facts reach the page", () => {
  it("prints the attributes a charger declares", () => {
    const { openTab, unmount } = render({
      ...CHARGER,
      attributes: [
        { id: "a1", label: "Brand", value: "Anker" },
        { id: "a2", label: "Warranty", value: "1 year" },
      ],
    });
    try {
      const opened = openTab("Details");
      expect(opened).toContain("Brand");
      expect(opened).toContain("Anker");
      expect(opened).toContain("Warranty");
      expect(opened).toContain("1 year");
    } finally {
      unmount();
    }
  });

  it("offers no Details tab to a product that states nothing", () => {
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).not.toContain(">Details<");
    } finally {
      unmount();
    }
  });
});

describe("the food tabs belong to food", () => {
  it("shows a charger no Ingredients, Nutrition, Allergens or Care tab", () => {
    /**
     * Each of these used to render unconditionally with bakery prose to print
     * when the field was empty — so a phone charger's page carried an
     * Ingredients tab reading "Flour, sugar, butter, fresh cream, premium
     * chocolate, and natural flavours", a Care tab saying "Refrigerate within
     * 2 hours of delivery", and a Nutrition tab promising calorie information.
     */
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).not.toContain(">Ingredients<");
      expect(html).not.toContain(">Nutrition<");
      expect(html).not.toContain(">Allergens<");
      expect(html).not.toContain(">Care<");
      expect(html).not.toContain("Flour, sugar, butter");
      expect(html).not.toContain("Refrigerate within 2 hours");
      expect(html).not.toContain("Calorie information will be updated soon");
    } finally {
      unmount();
    }
  });

  it("does not append a bakery sentence to every description", () => {
    const { html, unmount } = render(CHARGER);
    try {
      expect(html).toContain("Fast charging for phones and laptops.");
      expect(html).not.toContain("finished by");
      expect(html).not.toContain("expert bakers");
    } finally {
      unmount();
    }
  });

  it("still shows a cake the tabs it actually fills", () => {
    const { html, openTab, unmount } = render({
      ...CAKE,
      ingredients: "Flour, cocoa, cream.",
      allergens: "Contains milk and wheat.",
      careInstructions: "Refrigerate on arrival.",
      calories: 320,
    });
    try {
      expect(html).toContain(">Ingredients<");
      expect(html).toContain(">Nutrition<");
      expect(html).toContain(">Allergens<");
      expect(html).toContain(">Care<");
      // Opened, not merely listed — Radix mounts only the active tab's content.
      expect(openTab("Ingredients")).toContain("Flour, cocoa, cream.");
      expect(openTab("Care")).toContain("Refrigerate on arrival.");
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
