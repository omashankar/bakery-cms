/**
 * Regression tests for defects caused by bakery vocabulary being load-bearing
 * in business logic.
 *
 * These were all `.fails()` while the bugs were live. They now assert the
 * correct behaviour: variant options carry an explicit `semantic`, and logic
 * branches on that instead of pattern-matching English words in a label.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  backfillLegacyGroups,
  createDefaultVariantGroups,
  getDefaultVariantSelections,
  setGroupDefaultBySemantic,
  syncLegacyFlagsFromVariants,
} from "@/features/products/lib/variant-utils";
import { createEmptyProductForm, loadProducts } from "@/features/products/lib/products-repository";
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
    ...syncLegacyFlagsFromVariants(form.variantGroups, getDefaultVariantSelections(form.variantGroups)),
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
    const form = tickEggless(createEmptyProductForm(), true);
    const eggGroup = form.variantGroups.find((g) => g.type === "egg");

    expect(eggGroup?.options.find((o) => o.isDefault)?.semantic).toBe("eggless");
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

describe("SMELL: the shape list is triplicated and divergent", () => {
  // Not a runtime bug — normalizeCommerceFields only runs on the seed path, so
  // a merchant's empty shape list is preserved. The defect is that three
  // separate literals define "the shapes" and they disagree.
  it("documents that the admin form offers a shape no default list knows about", () => {
    // features/admin/cakes/components/cake-form-page.tsx (UI stays in admin)
    const formOffers = ["Round", "Square", "Heart", "Rectangle"];
    // features/products/lib/cake-mapper.ts:5
    const mapperDefaults = ["Round", "Square", "Heart"];
    // features/storefront/lib/product-details.ts:58-59
    const storefrontFallback = ["Round", "Square", "Heart"];

    expect(createEmptyProductForm().shapes).toEqual(mapperDefaults);
    expect(mapperDefaults).toEqual(storefrontFallback);
    expect(formOffers).toContain("Rectangle");
    expect(mapperDefaults).not.toContain("Rectangle");
  });
});
