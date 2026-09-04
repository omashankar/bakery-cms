import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import {
  asAddOn,
  calculateVariantAdjustment,
  getDefaultVariantSelections,
} from "@/features/products/lib/variant-utils";
import { formatVariantSummary } from "@/features/products/lib/product-pricing";
import { getCartItems } from "@/features/cart/lib/cart";

/**
 * A shop types "Eggless", puts ₹80 beside it, and leaves Default clear.
 *
 * That is the whole description of an add-on, and this model could not hold it.
 * Every group was always answered: `getDefaultVariantSelections` fell back to
 * the first option, `calculateVariantAdjustment` fell back to it again, and
 * `createVariantGroup` promoted it at creation — so a one-option group was
 * charged for from the moment it existed, and the page showed a lone button
 * already pressed. There was no way to say "the customer does not have this
 * unless they ask for it".
 *
 * No default now means exactly what it looks like: nothing selected, nothing
 * charged, and on the page one tickbox with the label and its price.
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

/** One option, no default — the shape a shop actually types. */
const EGGLESS_ADD_ON = {
  id: "g-egg",
  name: "Egg preference",
  type: "egg",
  options: [{ id: "eggless", label: "Eggless", priceAdjustment: 80, isDefault: false }],
};

const HEART_ADD_ON = {
  id: "g-shape",
  name: "Shape",
  type: "shape",
  options: [{ id: "heart", label: "Heart Shape", priceAdjustment: 150, isDefault: false }],
};

const CAKE = {
  id: "p-1",
  name: "Ring Ceremony Special",
  slug: "ring-ceremony",
  description: "",
  price: 999,
  image: "/cake.jpg",
  category: "Cakes",
  inStock: true,
  weights: [],
  shapes: [],
  variantGroups: [EGGLESS_ADD_ON, HEART_ADD_ON],
};

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

function render(cake: unknown = CAKE) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      createElement(ProductDetailPage, {
        cake,
        modules: defaultModuleSettings,
        related: [],
        catalog: [],
      } as never),
    );
  });
  return container;
}

function ticks() {
  // The design system’s Checkbox stamps this slot on whatever element it
  // renders, which is the stable handle — the tag and the role are the
  // library’s business.
  return [...(container?.querySelectorAll('[data-slot="checkbox"]') ?? [])];
}

function click(element: Element | undefined) {
  act(() => {
    element?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
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
  window.localStorage.clear();
});

describe("what the model says an unanswered group is", () => {
  it("selects nothing for a group that names no default", () => {
    expect(getDefaultVariantSelections([EGGLESS_ADD_ON] as never)).toEqual({});
  });

  it("charges nothing for it", () => {
    /**
     * The fallback to `options[0]` charged for a choice nobody had made and no
     * default claimed — which is what made an opt-in impossible.
     */
    expect(calculateVariantAdjustment([EGGLESS_ADD_ON] as never, {})).toBe(0);
  });

  it("still charges a group the shop DID answer, selection or not", () => {
    // The default is substituted deliberately: a group the shop answers on the
    // customer's behalf must be charged whether or not the browser sent it,
    // which is what stops a crafted request dropping a surcharge.
    const answered = {
      ...EGGLESS_ADD_ON,
      options: [{ ...EGGLESS_ADD_ON.options[0], isDefault: true }],
    };

    expect(calculateVariantAdjustment([answered] as never, {})).toBe(80);
  });

  it("says nothing about it on the line", () => {
    // A cart line naming an option nobody chose tells the kitchen to make
    // something nobody asked for.
    expect(formatVariantSummary([EGGLESS_ADD_ON] as never, {})).toEqual([]);
  });
});

describe("the rule that turns it into a tickbox", () => {
  it("reads one option with no default as an add-on", () => {
    const addOn = asAddOn(EGGLESS_ADD_ON as never);

    expect(addOn?.on.label).toBe("Eggless");
    expect(addOn?.extra).toBe(80);
    // Nothing to fall back to: unticking selects no option at all.
    expect(addOn?.off).toBeNull();
  });

  it("refuses one option that IS the default", () => {
    /**
     * That is a fact about the product — it comes this way — and a box the
     * customer cannot untick is not a choice.
     */
    const fixed = {
      ...EGGLESS_ADD_ON,
      options: [{ ...EGGLESS_ADD_ON.options[0], isDefault: true }],
    };

    expect(asAddOn(fixed as never)).toBeNull();
  });
});

describe("the page a customer sees", () => {
  it("shows one tickbox per add-on, with its label", () => {
    const text = render().textContent ?? "";

    expect(ticks()).toHaveLength(2);
    expect(text).toContain("Eggless");
    expect(text).toContain("Heart Shape");
    // No heading over a single tick, and no button for it either.
    expect(render().innerHTML).not.toContain(">Egg preference<");
  });

  it("starts unticked, at the base price", () => {
    const view = render();

    expect(ticks().every((tick) => tick.getAttribute("aria-checked") !== "true")).toBe(true);
    expect(view.textContent).toContain("₹999");
  });

  it("adds the price the moment it is ticked", () => {
    const view = render();

    click(ticks()[0]);

    expect(view.textContent).toContain("₹1,079");
  });

  it("takes it back off when it is unticked", () => {
    const view = render();

    click(ticks()[0]);
    click(ticks()[0]);

    expect(view.textContent).toContain("₹999");
  });

  it("adds up when both are ticked", () => {
    const view = render();

    click(ticks()[0]);
    click(ticks()[1]);

    expect(view.textContent).toContain("₹1,229");
  });
});

describe("what the cart is told", () => {
  it("records only the add-ons that were ticked", () => {
    render();

    click(ticks()[1]);
    click(
      [...(container?.querySelectorAll("button") ?? [])].find((node) =>
        node.textContent?.includes("Add to Cart"),
      ),
    );

    const line = getCartItems()[0];
    expect(line?.variantSummary).toEqual(["Shape: Heart Shape"]);
    expect(line?.price).toBe(1149);
  });

  it("records nothing at all when none were", () => {
    render();

    click(
      [...(container?.querySelectorAll("button") ?? [])].find((node) =>
        node.textContent?.includes("Add to Cart"),
      ),
    );

    const line = getCartItems()[0];
    expect(line?.variantSummary ?? []).toEqual([]);
    expect(line?.price).toBe(999);
  });
});
