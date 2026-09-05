import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import { cartLineChoices } from "@/features/cart/lib/cart";
import { mapAdminProductToStorefront } from "@/features/products/lib/product-mapper";
import { productFormSchema } from "@/features/products/server/product.validators";
import { DEFAULT_SIZE_AXIS_LABEL, weightAxisLabel } from "@/features/products/lib/product-pricing";
import { ProductModel } from "@/lib/server/db/models/product.model";

/**
 * A t-shirt shop's product page said “Weight: S / M / L”.
 *
 * Every option group on this page has been named by the shop since variant
 * groups existed — the heading is `group.name`, whatever was typed. The FIRST
 * and oldest axis, `weights`, was the exception: its heading was the literal
 * string “Weight” in the markup, and the admin's own editor was headed “Weight
 * variants”. So the one axis nearly every shop uses was the one no shop could
 * name, and a shop selling shirts, cable or storage had to accept a bakery noun
 * over its own buttons — and then over the value on the invoice and in the
 * email to the kitchen, since `cartLineChoices` labels it there.
 *
 * `weightLabel` is a plain optional string on the product, which means it has
 * to clear the same five gates every product field does: the type, the Mongoose
 * path (strict mode drops an undeclared one on write and still answers 201),
 * the Zod validator, the storefront mapper's WHITELIST, and a box in the admin
 * form. Four of the five fail silently. This walks all of them, and then the
 * surfaces that read it.
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

/** A shirt: sold along a size axis that is not a weight. */
const SHIRT = {
  id: "p-tee",
  name: "Cotton Tee",
  slug: "cotton-tee",
  description: "Soft cotton.",
  price: 799,
  image: "/tee.jpg",
  category: "Shirts",
  inStock: true,
  weights: [
    { label: "S", price: 799 },
    { label: "M", price: 799 },
    { label: "L", price: 849 },
  ],
  shapes: [],
  variantGroups: [],
};

/** The heading over the size buttons, read out of the rendered page. */
function sizeHeading(cake: Record<string, unknown>): string {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      createElement(ProductDetailPage, {
        cake,
        related: [],
        catalog: [],
        modules: defaultModuleSettings,
      } as never),
    );
  });

  const gate = container.querySelector("[data-gate-weight]");
  if (!gate) throw new Error("the size picker did not render at all");
  const heading = gate.textContent ?? "";

  act(() => {
    root.unmount();
  });
  container.remove();
  return heading;
}

describe("the shop's own word for the size axis", () => {
  it("heads the picker on the product page", () => {
    const heading = sizeHeading({ ...SHIRT, weightLabel: "Size" });

    expect(heading).toContain("Size");
    expect(heading).not.toContain("Weight");
  });

  it("takes whatever word the shop typed, not one of a known set", () => {
    // Not an enum, and not guessed from the category: a hardware shop selling
    // cable by the metre types “Length” and gets “Length”.
    expect(sizeHeading({ ...SHIRT, weightLabel: "Length" })).toContain("Length");
  });

  it("falls back to a generic word, never to a trade's", () => {
    /**
     * The same rule `DEFAULT_LABELS` follows in saying “Product” and not
     * “Cake”: a default that names one trade is the same defect as a
     * hard-coded one, written somewhere nicer. Nothing prefills this box.
     */
    const heading = sizeHeading(SHIRT);

    expect(heading).toContain(DEFAULT_SIZE_AXIS_LABEL);
    expect(heading).not.toContain("Weight");
  });

  it("treats a box holding only spaces as empty", () => {
    expect(weightAxisLabel("   ")).toBe(DEFAULT_SIZE_AXIS_LABEL);
    expect(weightAxisLabel(undefined)).toBe(DEFAULT_SIZE_AXIS_LABEL);
    expect(weightAxisLabel("Tin size")).toBe("Tin size");
  });
});

describe("the word survives the write path", () => {
  it("is accepted by the validator", () => {
    const parsed = productFormSchema.parse({
      name: "Cotton Tee",
      slug: "cotton-tee",
      description: "Soft cotton.",
      price: 799,
      images: ["/tee.jpg"],
      categoryId: "cat-shirts",
      occasionIds: [],
      weights: [{ label: "S", price: 799 }],
      weightLabel: "Size",
      status: "published",
      isFeatured: false,
      isBestSeller: false,
      isTrending: false,
      isPhotoCake: false,
      isSeasonal: false,
      shapes: [],
      flavourOptions: [],
      stockStatus: "in_stock",
      stockQuantity: 10,
      unlimitedStock: false,
      allowsMessage: false,
      allowsPhotoUpload: false,
      variantGroups: [],
      rating: 0,
      reviewCount: 0,
      seo: {},
    } as never) as { weightLabel?: string };

    expect(parsed.weightLabel).toBe("Size");
  });

  it("is not dropped by Mongoose strict mode", () => {
    /**
     * THE TRAP, and half the reason this file exists. `productSchema` runs with
     * strict on, so a path it has not been told about is discarded when the
     * document is BUILT — no error, no rejected write, and the API answers 201.
     * Constructed rather than saved, so no database is needed to prove it.
     */
    const doc = new ProductModel({
      _id: "p-tee",
      name: "Cotton Tee",
      slug: "cotton-tee",
      weightLabel: "Size",
    });

    const stored = doc.toObject() as { weightLabel?: string };

    expect(stored.weightLabel, "Mongoose strict mode dropped the field").toBe("Size");
  });

  it("crosses the storefront mapper, which is a whitelist and not a spread", () => {
    // The other silent failure: a field missing from that list persists
    // perfectly and is never seen by a customer.
    const mapped = mapAdminProductToStorefront({
      id: "p-tee",
      name: "Cotton Tee",
      slug: "cotton-tee",
      description: "",
      price: 799,
      images: ["/tee.jpg"],
      categoryId: "cat-shirts",
      occasionIds: [],
      weights: [{ label: "S", price: 799 }],
      weightLabel: "Size",
      status: "published",
      shapes: [],
      flavourOptions: [],
      attributes: [],
      rating: 0,
      reviewCount: 0,
    } as never);

    expect(mapped.weightLabel).toBe("Size");
  });
});

describe("the word reaches every surface that names the value", () => {
  it("heads the value on the cart line, the invoice and the kitchen email", () => {
    // One function builds that list for all six screens, so this is all of them.
    expect(cartLineChoices({ weight: "M", weightLabel: "Size" })).toEqual(["Size: M"]);
  });

  it("falls back for a line stored before the shop named the axis", () => {
    // Orders already placed carry no label. They must still read as something.
    expect(cartLineChoices({ weight: "1 kg" })).toEqual([`${DEFAULT_SIZE_AXIS_LABEL}: 1 kg`]);
  });

  it("says nothing at all when there is no size on the line", () => {
    expect(cartLineChoices({ weightLabel: "Size" })).toEqual([]);
  });
});

describe("the filter panel, which spans the whole catalogue", () => {
  /**
   * NOTHING in the suite rendered this component. A syntax error introduced in
   * it while writing this file left all 2,527 tests green — so a storefront
   * panel every collection page ships could break outright and the suite would
   * still say the shop was fine. This is the smallest render that would have
   * failed.
   */
  it("heads the size filter with the generic word, not a trade's", async () => {
    const { CollectionFiltersPanel } = await import(
      "@/components/storefront/collection-filters-panel"
    );
    const { DEFAULT_COLLECTION_FILTERS } = await import("@/apps/website/lib/collection-filters");

    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        createElement(CollectionFiltersPanel, {
          filters: DEFAULT_COLLECTION_FILTERS,
          onChange: () => undefined,
        }),
      );
    });

    const text = container.textContent ?? "";
    try {
      // One filter, over a catalogue that may hold cakes AND shirts: it cannot
      // read any single product's word, and "Weight: S, M, L" is simply wrong.
      expect(text).toContain(DEFAULT_SIZE_AXIS_LABEL);
      expect(text).not.toContain("Weight");
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });
});
