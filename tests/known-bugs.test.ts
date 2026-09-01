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
  setGroupDefaultBySemantic,
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
    ...syncLegacyFlagsFromVariants(
      form.variantGroups,
      getDefaultVariantSelections(form.variantGroups),
      /**
       * THE THIRD ARGUMENT, which this mirror was missing.
       *
       * The real form passes the tick the merchant made, and
       * `syncLegacyFlagsFromVariants` falls back to it whenever the variant data
       * cannot answer — a product with no egg group, which is now every new
       * product. Without it the flag is derived as `false` unconditionally,
       * which is the very bug the function's own header describes. A mirror that
       * has drifted from what it mirrors tests nothing.
       */
      { isEggless: form.isEggless, isPhotoCake: form.isPhotoCake },
    ),
  };
}

/** Mirrors what the admin Eggless checkbox now does. */
function tickEggless(form: ProductFormData, isEggless: boolean): ProductFormData {
  return {
    ...form,
    isEggless,
    variantGroups: setGroupDefaultBySemantic(form.variantGroups, "egg", "eggless", isEggless),
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

describe("the admin Eggless checkbox survives a save", () => {
  it("keeps the merchant's Eggless tick", () => {
    const form = tickEggless(createEmptyProductForm(), true);

    expect(composeSavePayload(form).isEggless).toBe(true);
  });

  it("keeps an explicit untick", () => {
    const ticked = tickEggless(createEmptyProductForm(), true);
    const unticked = tickEggless(ticked, false);

    expect(composeSavePayload(unticked).isEggless).toBe(false);
  });

  it("moves the variant default onto the eggless option, so the data agrees with the flag", () => {
    // A new product no longer arrives carrying an egg group — a shop selling
    // chargers was never going to want one. This is the bakery's own path: the
    // Variants tab's "Reset to defaults", and then the tick.
    const withEggGroup: ProductFormData = {
      ...createEmptyProductForm(),
      variantGroups: createDefaultVariantGroups(),
    };
    const form = tickEggless(withEggGroup, true);
    const eggGroup = form.variantGroups.find((g) => g.type === "egg");

    expect(eggGroup?.options.find((o) => o.isDefault)?.semantic).toBe("eggless");
    // And the flag still survives the save, which is what this file is about.
    expect(composeSavePayload(form).isEggless).toBe(true);
  });

  it("keeps the tick on a product that has no egg group at all", () => {
    // The common case now. The variants cannot answer, so the merchant's own
    // statement is the only one there is.
    const form = tickEggless(createEmptyProductForm(), true);

    expect(form.variantGroups).toEqual([]);
    expect(composeSavePayload(form).isEggless).toBe(true);
  });
});

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
  it("survives rewording the eggless option", () => {
    const groups = setGroupDefaultBySemantic(
      createDefaultVariantGroups({ isEggless: true }),
      "egg",
      "eggless",
      true
    );
    const reworded = groups.map((group) => ({
      ...group,
      options: group.options.map((option) =>
        option.semantic === "eggless" ? { ...option, label: "No egg" } : option
      ),
    }));

    expect(syncLegacyFlagsFromVariants(reworded, getDefaultVariantSelections(reworded)).isEggless).toBe(
      true
    );
  });

  it("survives translating the eggless option out of English", () => {
    const groups = createDefaultVariantGroups({ isEggless: true });
    const translated = groups.map((group) => ({
      ...group,
      options: group.options.map((option) =>
        option.semantic === "eggless" ? { ...option, label: "अंडा रहित" } : option
      ),
    }));

    expect(
      syncLegacyFlagsFromVariants(translated, getDefaultVariantSelections(translated)).isEggless
    ).toBe(true);
  });

  it("survives renaming the photo print option", () => {
    const groups = createDefaultVariantGroups({ isPhotoCake: true });
    const renamed = groups.map((group) => ({
      ...group,
      options: group.options.map((option) =>
        option.semantic === "photo-print" ? { ...option, label: "Edible image" } : option
      ),
    }));

    expect(syncLegacyFlagsFromVariants(renamed, getDefaultVariantSelections(renamed)).isPhotoCake).toBe(
      true
    );
  });

  it("does not treat an unrelated option that happens to say 'eggless' as the eggless variant", () => {
    // A custom group whose label mentions eggless must not flip the product flag.
    const groups = createDefaultVariantGroups();
    const withDecoy = [
      ...groups,
      {
        id: "decoy",
        name: "Message",
        type: "custom" as const,
        required: false,
        options: [{ id: "d1", label: "Write 'eggless' on the cake", priceAdjustment: 0, isDefault: true }],
      },
    ];

    expect(
      syncLegacyFlagsFromVariants(withDecoy, getDefaultVariantSelections(withDecoy)).isEggless
    ).toBe(false);
  });
});

describe("legacy data stored before `semantic` existed is migrated on read", () => {
  it("backfills the eggless semantic from an old English label", () => {
    const legacy = [
      {
        id: "g1",
        name: "Egg preference",
        type: "egg" as const,
        required: true,
        options: [
          { id: "o1", label: "Regular", priceAdjustment: 0, isDefault: false },
          { id: "o2", label: "Eggless", priceAdjustment: 80, isDefault: true },
        ],
      },
    ];

    const migrated = backfillLegacyGroups(legacy);

    expect(migrated[0].options[1].semantic).toBe("eggless");
    expect(migrated[0].options[0].semantic).toBeUndefined();
    expect(syncLegacyFlagsFromVariants(migrated, getDefaultVariantSelections(migrated)).isEggless).toBe(
      true
    );
  });

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
        name: "Egg preference",
        type: "egg" as const,
        required: true,
        options: [
          // Already migrated, and since relabelled by the merchant.
          { id: "o1", label: "No egg", semantic: "eggless" as const, priceAdjustment: 80, isDefault: true },
        ],
      },
    ];

    expect(backfillLegacyGroups(groups)[0].options[0].semantic).toBe("eggless");
  });
});

describe("editing a seeded product does not silently drop its flags", () => {
  // The most common way data is lost: a merchant opens an existing cake and
  // saves it without changing anything.
  it("round-trips isEggless and isPhotoCake through an unedited save", () => {
    const cakes = loadProducts();
    const eggless = cakes.find((cake) => cake.isEggless);
    const photo = cakes.find((cake) => cake.isPhotoCake);

    // Guard: if the seed stops containing these, the assertions below are vacuous.
    expect(eggless, "seed should contain an eggless cake").toBeDefined();
    expect(photo, "seed should contain a photo cake").toBeDefined();

    expect(composeSavePayload(eggless as ProductFormData).isEggless).toBe(true);
    expect(composeSavePayload(photo as ProductFormData).isPhotoCake).toBe(true);
  });
});

describe("SMELL: the shape list is duplicated and divergent", () => {
  /**
   * Two of the four copies are gone. It was TRIPLICATED, and worse than
   * duplicated — the two copies that mattered were not lists of what a product
   * offers but defaults imposed on every product that named none, so a phone
   * charger was sold in Round, Square and Heart.
   *
   * Removed: `createEmptyProductForm().shapes` (a new product now names none)
   * and `getProductShapeOptions`' storefront fallback (a product with no shapes
   * now shows no shape picker, instead of three cake shapes and an order line
   * stamped "Round").
   *
   * What remains is a genuine, narrower smell: the admin form hardcodes the
   * four shapes it offers as checkboxes, while `DEFAULT_PRODUCT_SHAPES` — now
   * reached only by the demo bakery seed — knows three. Tick "Rectangle" and no
   * shared list agrees it exists.
   */
  it("documents that the admin form offers a shape no shared list knows about", () => {
    // The two removals, pinned so they cannot quietly come back.
    expect(createEmptyProductForm().shapes).toEqual([]);
    expect(getProductShapeOptions({ shapes: [] } as never)).toEqual([]);

    /**
     * Read from the FORM, not retyped here.
     *
     * The first version of this declared `const formOffers = ["Round","Square",
     * "Heart","Rectangle"]` three lines above `expect(formOffers).toContain
     * ("Rectangle")` — a literal checked against itself, which is true for as
     * long as someone keeps typing it and says nothing about the form. Delete
     * Rectangle from the checkboxes and it would still have passed.
     */
    const form = readFileSync(
      join(process.cwd(), "apps/admin/products/components/product-form-page.tsx"),
      "utf8",
    );
    const shapeBlock = form.slice(form.indexOf("Available shapes"));
    const formOffers = [...shapeBlock.matchAll(/"(Round|Square|Heart|Rectangle)"/g)].map(
      (match) => match[1],
    );

    expect(formOffers).toContain("Rectangle");
    // features/products/lib/product-mapper.ts:5 — now the demo seed's list only.
    expect([...DEFAULT_PRODUCT_SHAPES]).not.toContain("Rectangle");
  });
});
