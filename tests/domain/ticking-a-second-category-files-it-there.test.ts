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
 * The regression it exists for is the quiet one: MOVING a product to a
 * different primary leaves the old primary filed in the array behind it — so a
 * cake moved out of Birthday is still on the Birthday page, the owner has done
 * the thing they meant to do, and the page they were tidying is unchanged.
 *
 * That regression was LIVE for the whole time this file claimed to cover it.
 * Rebuilding the payload is not the answer on its own, because the form
 * rebuilds it from its own state, and that state is the product as the server
 * returned it — where `categoryIds` already holds the primary. The case named
 * for the move asserted `fileUnderCategories("cat-plants", [])`, hardcoding as
 * empty the one argument the bug is about, and sat green over it.
 *
 * So the move is now driven through the real dropdown and asked of the real
 * screen. The lesson is the file's own: an assertion that never touches the
 * thing it is named for cannot fail, and a green suite is not coverage.
 */
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Product } from "@/types/product";
import {
  fileUnderCategories,
  refileUnder,
} from "@/features/products/lib/products-repository";

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

/*
  A `click` helper stood here, wrapping a dispatch in `act` so the form could
  be driven the way React's own docs drive one. Nothing ever called it, and
  that was not an oversight: wrapped in `act`, an interaction with this form
  never settles and the case dies on the 5s timeout. Left in place it read as
  a working tool, so the next person to want a click would have reached for it
  and lost the afternoon this one did. `chooseCategory` below is what does
  work here — dispatch, then watch the DOM.
*/

/**
 * Whether a row in the grid is ticked, read off the control rather than state.
 *
 * Base UI puts the id on a hidden `<input aria-hidden>` and the semantics on a
 * sibling `[role="checkbox"]`, so `aria-checked` there is the thing a screen
 * reader — and an owner — is actually told.
 */
function tickState(label: HTMLElement | undefined): string | null | undefined {
  return label?.querySelector('[role="checkbox"]')?.getAttribute("aria-checked");
}

/**
 * Pick a primary category through the real `<select>`.
 *
 * DISPATCHED AND THEN POLLED, never wrapped in `act` — see the note above
 * about the helper that was. Wrap an interaction with this form in `act` and
 * it never settles; the case dies on the 5s timeout, which is the limitation
 * `saving-an-archived-record-keeps-it-archived` records. `openTheCake` above
 * already renders outside `act` and waits for the DOM to catch up, and that is
 * the pattern that works here: cause the thing, then watch the screen for it.
 *
 * React also tracks the DOM value it last wrote and swallows a `change` whose
 * value it believes is unchanged, so the assignment goes through the
 * prototype's own setter rather than the element.
 */
async function chooseCategory(root: HTMLElement, id: string) {
  /**
   * Found by element and id, NOT by `root.querySelector("#category")`.
   *
   * jsdom resolves an `#id` selector through `document.getElementById`, which
   * answers with the first match in the WHOLE document. Each rendered form
   * carries its own `#category`, so a scoped query against the second one
   * returns null rather than the select sitting inside it — a lookup that
   * fails only once a second copy exists, which is the worst kind.
   */
  const select = [...root.querySelectorAll("select")].find(
    (el) => el.id === "category",
  ) as HTMLSelectElement | undefined;
  expect(select, "the Category dropdown was not rendered").toBeTruthy();

  const setValue = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value",
  )?.set;
  setValue?.call(select, id);
  select?.dispatchEvent(new Event("change", { bubbles: true }));

  // The grid re-draws from the new primary: the chosen category leaves the
  // list, which is the commit this waits for rather than a fixed tick.
  const chosen = adminCategoryName(id);
  for (let i = 0; i < 80 && labelled(root, new RegExp(chosen)); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

/** The two rows the mock offers, by id — so the wait above has a word to watch. */
function adminCategoryName(id: string): string {
  return id === "cat-plants" ? "Money Plants" : "Celebration Cakes";
}

beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  sent.payloads.length = 0;
  // Each case renders its own form. Left mounted, they accumulate in one
  // document and every id in the form exists several times over.
  document.body.replaceChildren();
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

  it("does not leave the old primary ticked when a product is moved", async () => {
    /**
     * THE QUIET REGRESSION THIS WHOLE FILE EXISTS FOR, DRIVEN THROUGH THE
     * DROPDOWN RATHER THAN ASSERTED ON A HELPER.
     *
     * This case used to read `fileUnderCategories("cat-plants", [])` and pass.
     * It could not fail: it hardcoded the second argument as empty, and the
     * whole bug is that the form does NOT pass an empty array there. The form
     * passes `form.categoryIds`, which is the product exactly as the server
     * returned it — and the server's array already contains the primary. So
     * moving this cake from Cakes to Plants really did build
     * `["cat-plants", "cat-cakes"]`, and a test named for that regression sat
     * green over it.
     *
     * Rebuilding the payload was never the missing half. What the screen
     * CARRIES into the rebuild is. So this drives the real control and asks
     * the real question: after the move, is the category it was moved out of
     * still ticked? The grid renders straight off `form.categoryIds`, so the
     * tick is that state, visible.
     */
    const form = await openTheCake();

    await chooseCategory(form, "cat-plants");

    const leftBehind = labelled(form, /Celebration Cakes/);
    expect(leftBehind, "the category it was moved out of is no longer offered").toBeDefined();
    expect(
      tickState(leftBehind),
      "the cake was moved out of Celebration Cakes and stayed ticked under it",
    ).toBe("false");
  });

  it("and the rule behind it keeps a category the owner ticked", () => {
    /**
     * `refileUnder` drops only the two categories the dropdown is moving
     * BETWEEN. A membership the owner ticked for themselves is not collateral:
     * filed under Cakes with Chocolate ticked, promoting Plants keeps
     * Chocolate.
     */
    expect(
      refileUnder(
        { categoryId: "cat-cakes", categoryIds: ["cat-cakes", "cat-chocolate"] },
        "cat-plants",
      ),
    ).toEqual(["cat-chocolate"]);

    // Promoting a category that was already ticked leaves it in one place, not
    // two — it is about to be the primary.
    expect(
      refileUnder(
        { categoryId: "cat-cakes", categoryIds: ["cat-cakes", "cat-plants"] },
        "cat-plants",
      ),
    ).toEqual([]);
  });

  it("and clearing the box files it nowhere rather than stranding a tick", () => {
    /**
     * `categoryId: ""` means filed nowhere. Leaving memberships behind it
     * would break `categoryIds[0] === categoryId` AND strand them, because the
     * grid is hidden while there is no primary — nothing on screen could
     * untick what the save would still write.
     */
    expect(
      refileUnder({ categoryId: "cat-cakes", categoryIds: ["cat-cakes", "cat-plants"] }, ""),
    ).toEqual([]);
    expect(fileUnderCategories("", refileUnder({ categoryId: "cat-cakes" }, ""))).toEqual([]);
  });

  it("says each category once, and files nothing under a blank", () => {
    expect(fileUnderCategories("cat-cakes", ["cat-cakes", "", "cat-plants"])).toEqual([
      "cat-cakes",
      "cat-plants",
    ]);
    expect(fileUnderCategories("", [])).toEqual([]);
  });
});
