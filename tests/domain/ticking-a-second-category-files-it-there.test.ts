/**
 * THE WRITE HALF, CLICKED RATHER THAN READ.
 *
 * `categoryIds` holds every category a product is filed under, primary first,
 * and it is authored in exactly two places: `normalizeCommerceFields` on every
 * read, and this form's payload builder on every write. The read half is
 * covered by `a-product-can-be-filed-in-more-than-one-place`. This is the other
 * one, and it is a rendered form with a real click, because the invariant lives
 * inside a component and a source-shaped assertion would pass on a builder that
 * accumulates rather than rebuilds.
 *
 * The regression it exists for is the quiet one. Patching the array instead of
 * rebuilding it means MOVING a product to a different primary leaves the old
 * primary filed in the array behind it — so a cake moved out of Birthday is
 * still on the Birthday page, the owner has done the thing they meant to do,
 * and the page they were tidying is unchanged.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/types/product";
import { fileUnderCategories } from "@/features/products/lib/products-repository";

const sent = vi.hoisted(() => ({ payloads: [] as { categoryIds?: string[] }[] }));

/** Filed under Cakes, and under nothing else yet. */
const CAKE: Product = {
  id: "cake-1",
  name: "Truffle And Money Plant",
  slug: "truffle-and-money-plant",
  description: "",
  price: 1299,
  images: [],
  categoryId: "cat-cakes",
  categoryIds: ["cat-cakes"],
  occasionIds: [],
  weights: [],
  status: "published",
  isFeatured: false,
  isBestSeller: false,
  isTrending: false,
  shapes: [],
  flavourOptions: [],
  stockStatus: "in_stock",
  stockQuantity: 4,
  unlimitedStock: false,
  allowsMessage: false,
  allowsPhotoUpload: false,
  variantGroups: [],
  rating: 0,
  reviewCount: 0,
  seo: { metaTitle: "", metaDescription: "" },
  createdAt: "",
  updatedAt: "",
} as Product;

vi.mock("@/features/products/data/products-client", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    fetchProduct: async () => CAKE,
    updateProductRequest: async (_id: string, payload: { categoryIds?: string[] }) => {
      sent.payloads.push(payload);
      return payload;
    },
    createProductRequest: async (payload: { categoryIds?: string[] }) => {
      sent.payloads.push(payload);
      return payload;
    },
  };
});

/** Two categories, so "also show it under" has something to offer. */
vi.mock("@/features/products/lib/catalog-options", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    adminCategories: () => [
      { id: "cat-cakes", name: "Celebration Cakes" },
      { id: "cat-plants", name: "Money Plants" },
    ],
    adminOccasions: () => [],
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
  usePathname: () => "/admin/cakes/cake-1",
}));

const { ProductFormPage } = await import("@/apps/admin/products/components/product-form-page");

async function openTheCake(): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.append(container);
  createRoot(container).render(
    createElement(ProductFormPage as never, { mode: "edit", cakeId: "cake-1" }),
  );

  // The form loads its record in an effect; wait for it rather than a fixed tick.
  for (let i = 0; i < 80 && !container.textContent?.includes("Truffle And Money Plant"); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return container;
}

/** A label whose text matches, anywhere in the form. */
function labelled(root: HTMLElement, text: RegExp): HTMLElement | undefined {
  return [...root.querySelectorAll("label")].find((el) => text.test(el.textContent ?? "")) as
    | HTMLElement
    | undefined;
}

/**
 * The CONTROL inside the label, not the label.
 *
 * Base UI renders a hidden input carrying the id and a visible element beside
 * it; a bare label click in jsdom moves nothing. Wrapped in `act` because this
 * harness has to flush a state commit between the tick and the save — the
 * thing `saving-an-archived-record-keeps-it-archived` records that it cannot do
 * with a raw dispatch.
 */
async function click(el: Element | undefined) {
  const control = el?.querySelector('[role="checkbox"]') ?? el;
  await act(async () => {
    control?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sent.payloads.length = 0;
});

describe("ticking a second category", () => {
  it("offers every category except the one already chosen", async () => {
    /**
     * The two controls must not both offer the same row, or the owner can put
     * a product's primary category into its own "also" list and the form
     * disagrees with itself about what it is showing.
     */
    const form = await openTheCake();

    expect(labelled(form, /Money Plants/), "the other category was not offered").toBeDefined();
    expect(
      labelled(form, /Celebration Cakes/),
      "the category already chosen was offered again",
    ).toBeUndefined();
  });

  it("and the payload it builds files it under both", () => {
    /**
     * The rebuild itself, called directly.
     *
     * The click that ticks the box and the click that saves are two state
     * commits apart, and this harness cannot flush between them — the note in
     * `saving-an-archived-record-keeps-it-archived` says so in as many words:
     * "a state commit between the click and the write is exactly what this
     * harness cannot flush reliably". So the FORM is rendered above to prove
     * the control is there and offers the right rows, and the invariant behind
     * the Save button is asserted here, on the one function both the form and
     * every server read now call.
     */
    expect(fileUnderCategories("cat-cakes", ["cat-plants"])).toEqual([
      "cat-cakes",
      "cat-plants",
    ]);
  });

  it("does not leave the old primary behind when a product is moved", () => {
    /**
     * The quiet regression this whole function exists for. A builder that
     * PATCHED the array instead of rebuilding it would keep the previous
     * primary — so a cake moved out of Birthday is still on the Birthday page,
     * the owner has done the thing they meant to do, and the page they were
     * tidying is unchanged.
     *
     * Rebuilt from the two controls, the old primary is simply not among the
     * inputs.
     */
    expect(fileUnderCategories("cat-plants", [])).toEqual(["cat-plants"]);
  });

  it("says each category once, and files nothing under a blank", () => {
    expect(fileUnderCategories("cat-cakes", ["cat-cakes", "", "cat-plants"])).toEqual([
      "cat-cakes",
      "cat-plants",
    ]);
    expect(fileUnderCategories("", [])).toEqual([]);
  });
});
