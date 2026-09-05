/**
 * Regression tests for defects caused by bakery vocabulary being load-bearing
 * in business logic.
 *
 * These were all `.fails()` while the bugs were live. They now assert the
 * correct behaviour: variant options carry an explicit `semantic`, and logic
 * branches on that instead of pattern-matching English words in a label.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import {
  backfillLegacyGroups,
  createDefaultVariantGroups,
  getDefaultVariantSelections,
  syncLegacyFlagsFromVariants,
} from "@/features/products/lib/variant-utils";
import { createEmptyProductForm, loadProducts } from "@/features/products/lib/products-repository";
import { DEFAULT_PRODUCT_SHAPES } from "@/features/products/lib/product-mapper";
import { getProductShapeOptions } from "@/apps/website/lib/product-details";
import type { ProductFormData } from "@/types/product";

beforeEach(() => {
  localStorage.clear();
});

/**
 * Mirrors the save-time payload composition in
 * features/admin/cakes/components/cake-form-page.tsx.
 */
function composeSavePayload(form: ProductFormData): ProductFormData {
  return {
    ...form,
    /**
     * THE SECOND ARGUMENT, which this mirror was once missing.
     *
     * The real form passes the tick the merchant made, and
     * `syncLegacyFlagsFromVariants` falls back to it whenever the variant data
     * cannot answer — a product with no photo group, which is most of them.
     * Without it the flag is derived as `false` unconditionally, which is the
     * very bug the function's own header describes. A mirror that has drifted
     * from what it mirrors tests nothing.
     */
    ...syncLegacyFlagsFromVariants(form.variantGroups, {
      isPhotoCake: form.isPhotoCake,
    }),
  };
}


/** Mirrors what the admin Photo cake checkbox now does when unticked. */
function untickPhotoCake(form: ProductFormData): ProductFormData {
  return {
    ...form,
    isPhotoCake: false,
    variantGroups: form.variantGroups.filter((group) => group.type !== "photo"),
  };
}

/*
  "the admin Eggless checkbox survives a save" stood here — four cases about a
  tick whose flag was derived unconditionally, so it came back off on every
  save of a product with no egg group.

  Both halves have gone: the tick, and `Product.isEggless` behind it. A recipe
  is the shop's claim to make in its own words, and an eggless VERSION is an
  ordinary priced option. The Photo cake describe below is the same mechanism
  and the same trap, still guarded.
*/

describe("the admin Photo cake checkbox survives a save", () => {
  it("keeps the merchant's Photo cake tick", () => {
    const form: ProductFormData = {
      ...createEmptyProductForm(),
      isPhotoCake: true,
      variantGroups: createDefaultVariantGroups({ isPhotoCake: true }),
    };

    expect(composeSavePayload(form).isPhotoCake).toBe(true);
  });

  it("stays true even though the group's default is the non-photo option", () => {
    // "Standard design" is deliberately the default — the print is a paid
    // upsell. isPhotoCake means "offers photo printing", not "defaults to it".
    const form: ProductFormData = {
      ...createEmptyProductForm(),
      isPhotoCake: true,
      variantGroups: createDefaultVariantGroups({ isPhotoCake: true }),
    };
    const photoGroup = form.variantGroups.find((g) => g.type === "photo");

    expect(photoGroup?.options.find((o) => o.isDefault)?.semantic).toBeUndefined();
    expect(composeSavePayload(form).isPhotoCake).toBe(true);
  });

  it("goes false when the merchant unticks it", () => {
    const ticked: ProductFormData = {
      ...createEmptyProductForm(),
      isPhotoCake: true,
      variantGroups: createDefaultVariantGroups({ isPhotoCake: true }),
    };

    expect(composeSavePayload(untickPhotoCake(ticked)).isPhotoCake).toBe(false);
  });
});

describe("flags survive relabelling, because logic reads semantics not labels", () => {
  /*
    Two cases stood here, about rewording and then translating the eggless
    option — proving the flag was read off `semantic` and never off the label.
    The flag has gone, and with it the only thing a label could have fooled.
    The photo case below makes the same point about the mechanism that stays.
  */

  it("survives renaming the photo print option", () => {
    const groups = createDefaultVariantGroups({ isPhotoCake: true });
    const renamed = groups.map((group) => ({
      ...group,
      options: group.options.map((option) =>
        option.semantic === "photo-print" ? { ...option, label: "Edible image" } : option
      ),
    }));

    expect(syncLegacyFlagsFromVariants(renamed).isPhotoCake).toBe(true);
  });

  it("does not treat an unrelated option that happens to say 'photo' as the print", () => {
    // A custom group whose label mentions a photo must not flip the flag.
    const withDecoy = [
      {
        id: "decoy",
        name: "Message",
        type: "custom" as const,
        required: false,
        options: [
          { id: "d1", label: "Write 'photo' on it", priceAdjustment: 0, isDefault: true },
        ],
      },
    ];

    expect(syncLegacyFlagsFromVariants(withDecoy).isPhotoCake).toBe(false);
  });
});

describe("legacy data stored before `semantic` existed is migrated on read", () => {
  /*
    The eggless twin of the case below stood here. `backfillSemantic` no
    longer has an egg branch to run — a stored egg group is now an ordinary
    group, priced and summarised like any other, and no flag is derived from
    what its options mean.
  */

  it("backfills the photo-print semantic from an old English label", () => {
    const legacy = [
      {
        id: "g2",
        name: "Photo cake",
        type: "photo" as const,
        required: false,
        options: [
          { id: "p1", label: "Standard design", priceAdjustment: 0, isDefault: true },
          { id: "p2", label: "Custom photo print", priceAdjustment: 250, isDefault: false },
        ],
      },
    ];

    const migrated = backfillLegacyGroups(legacy);

    expect(migrated[0].options[1].semantic).toBe("photo-print");
    expect(syncLegacyFlagsFromVariants(migrated, getDefaultVariantSelections(migrated)).isPhotoCake).toBe(
      true
    );
  });

  it("never overwrites a semantic that is already set", () => {
    const groups = [
      {
        id: "g3",
        name: "Photo cake",
        type: "photo" as const,
        required: false,
        options: [
          // Already migrated, and since relabelled by the merchant.
          {
            id: "o1",
            label: "Edible image",
            semantic: "photo-print" as const,
            priceAdjustment: 250,
            isDefault: false,
          },
        ],
      },
    ];

    expect(backfillLegacyGroups(groups)[0].options[0].semantic).toBe("photo-print");
  });
});

describe("editing a seeded product does not silently drop its flags", () => {
  // The most common way data is lost: a merchant opens an existing cake and
  // saves it without changing anything.
  it("round-trips isPhotoCake through an unedited save", () => {
    const cakes = loadProducts();
    const photo = cakes.find((cake) => cake.isPhotoCake);

    // Guard: if the seed stops containing one, the assertion below is vacuous.
    expect(photo, "seed should contain a photo cake").toBeDefined();

    expect(composeSavePayload(photo as ProductFormData).isPhotoCake).toBe(true);
  });
});

describe("the shape list was duplicated and divergent, and is not any more", () => {
  /**
   * CLOSED. It was FOUR copies, and the two that mattered were not lists of
   * what a product offers but defaults imposed on every product that named
   * none — so a phone charger was sold in Round, Square and Heart.
   *
   * The last of it was the admin form hardcoding four shapes as checkboxes
   * while `DEFAULT_PRODUCT_SHAPES` knew three: tick “Rectangle” and no shared
   * list agreed it existed. That list is gone. A shape is a typed VARIANT
   * GROUP now, so a shop names its own and prices each one, and there is no
   * second list left to diverge from.
   */
  it("names no shapes of its own anywhere", () => {
    expect(createEmptyProductForm().shapes).toEqual([]);
    expect(getProductShapeOptions({ shapes: [] } as never)).toEqual([]);

    const form = readFileSync(
      join(process.cwd(), "apps/admin/products/components/product-form-page.tsx"),
      "utf8",
    );

    // Read from the FORM, not retyped here — the first version of this declared
    // the four names three lines above asserting on them, which is a literal
    // checked against itself.
    expect(form).not.toContain("Available shapes");
    expect(form).not.toContain("toggleShape");
  });
});
