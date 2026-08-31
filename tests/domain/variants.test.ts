/**
 * Characterisation tests for the variant seam.
 *
 * The variant system is the generic mechanism that bakery-specific flags
 * (isEggless / isPhotoCake) are meant to be expressed through. These tests pin
 * its current behaviour before that migration is finished.
 */
import { describe, expect, it } from "vitest";

import {
  calculateVariantAdjustment,
  createDefaultVariantGroups,
  createVariantGroup,
  createVariantOption,
  getDefaultVariantSelections,
  getVariantOption,
  normalizeVariantGroups,
  syncLegacyFlagsFromVariants,
} from "@/features/products/lib/variant-utils";

describe("createVariantOption", () => {
  it("creates an option with a unique id and the given price adjustment", () => {
    const a = createVariantOption("Eggless", 80, true);
    const b = createVariantOption("Eggless", 80, true);

    expect(a.label).toBe("Eggless");
    expect(a.priceAdjustment).toBe(80);
    expect(a.isDefault).toBe(true);
    expect(a.id).not.toBe(b.id);
  });

  it("defaults to a zero adjustment and non-default flag", () => {
    const option = createVariantOption("Regular");

    expect(option.priceAdjustment).toBe(0);
    expect(option.isDefault).toBe(false);
  });
});

describe("createVariantGroup", () => {
  it("promotes the first option to default when none is marked", () => {
    const group = createVariantGroup("Size", "custom", [
      createVariantOption("Small"),
      createVariantOption("Large"),
    ]);

    expect(group.options[0].isDefault).toBe(true);
    expect(group.options[1].isDefault).toBe(false);
  });

  it("leaves an explicit default alone", () => {
    const group = createVariantGroup("Size", "custom", [
      createVariantOption("Small"),
      createVariantOption("Large", 0, true),
    ]);

    expect(group.options[0].isDefault).toBe(false);
    expect(group.options[1].isDefault).toBe(true);
  });
});

describe("createDefaultVariantGroups", () => {
  it("always produces an egg-preference group", () => {
    const groups = createDefaultVariantGroups();

    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("egg");
    expect(groups[0].options.map((o) => o.label)).toEqual(["Regular", "Eggless"]);
  });

  it("defaults to Regular for an egg cake and Eggless for an eggless one", () => {
    const regular = createDefaultVariantGroups({ isEggless: false });
    const eggless = createDefaultVariantGroups({ isEggless: true });

    expect(regular[0].options.find((o) => o.isDefault)?.label).toBe("Regular");
    expect(eggless[0].options.find((o) => o.isDefault)?.label).toBe("Eggless");
  });

  it("adds an optional photo group only for photo cakes", () => {
    const withPhoto = createDefaultVariantGroups({ isPhotoCake: true });
    const withoutPhoto = createDefaultVariantGroups({ isPhotoCake: false });

    expect(withPhoto.map((g) => g.type)).toEqual(["egg", "photo"]);
    expect(withoutPhoto.map((g) => g.type)).toEqual(["egg"]);
    expect(withPhoto[1].required).toBe(false);
  });

  it("prices the eggless upgrade at +80 and the custom photo print at +250", () => {
    const groups = createDefaultVariantGroups({ isPhotoCake: true });

    expect(groups[0].options.find((o) => o.label === "Eggless")?.priceAdjustment).toBe(80);
    expect(groups[1].options.find((o) => o.label === "Custom photo print")?.priceAdjustment).toBe(250);
  });
});

describe("normalizeVariantGroups", () => {
  it("keeps existing groups and backfills a missing default", () => {
    const existing = [
      {
        id: "g1",
        name: "Flavour",
        type: "custom" as const,
        required: true,
        options: [
          { id: "o1", label: "Vanilla", priceAdjustment: 0 },
          { id: "o2", label: "Chocolate", priceAdjustment: 50 },
        ],
      },
    ];

    const result = normalizeVariantGroups({
      variantGroups: existing,
      isEggless: false,
      isPhotoCake: false,
    });

    expect(result[0].options[0].isDefault).toBe(true);
    expect(result[0].options[1].isDefault).toBe(false);
  });

  it("invents nothing for a product that declared no groups", () => {
    /**
     * This used to assert the opposite — that an egg group was generated here.
     * That fallback ran on every repository read, so a shop selling a phone
     * charger got "Egg preference: Regular / Eggless +80" on the picker, in the
     * price, and on the order line, for a group nobody configured.
     *
     * `isEggless: true` is the strongest case: the old fallback made Eggless the
     * DEFAULT option, so the product silently cost 80 more than its own record
     * said. Absent is the honest answer; `createDefaultVariantGroups` still
     * exists for the admin's "reset to defaults", where a human asked for it.
     */
    const result = normalizeVariantGroups({
      variantGroups: [],
      isEggless: true,
      isPhotoCake: false,
    });

    expect(result).toEqual([]);
  });

  it("respects a default the merchant named, even when an earlier option omits the key", () => {
    /**
     * `isDefault: option.isDefault ?? index === 0` was evaluated per option, so
     * a group whose second option was explicitly the default, and whose first
     * simply omitted the key, came back with TWO defaults — and every consumer
     * resolves with `.find(o => o.isDefault)`, which takes the first. The
     * merchant's choice was replaced by the option above it, in the picker and
     * in what the customer was charged.
     */
    const result = normalizeVariantGroups({
      variantGroups: [
        {
          id: "g-size",
          name: "Storage",
          type: "custom",
          required: true,
          options: [
            { id: "o-128", label: "128 GB", priceAdjustment: 0 },
            { id: "o-256", label: "256 GB", priceAdjustment: 5000, isDefault: true },
          ],
        },
      ],
      isEggless: false,
      isPhotoCake: false,
    });

    expect(result[0].options.filter((o) => o.isDefault)).toHaveLength(1);
    expect(result[0].options.find((o) => o.isDefault)?.label).toBe("256 GB");
  });

  it("still falls back to the first option when the group names no default at all", () => {
    const result = normalizeVariantGroups({
      variantGroups: [
        {
          id: "g-colour",
          name: "Colour",
          type: "custom",
          required: true,
          options: [
            { id: "o-black", label: "Black", priceAdjustment: 0 },
            { id: "o-white", label: "White", priceAdjustment: 0 },
          ],
        },
      ],
      isEggless: false,
      isPhotoCake: false,
    });

    expect(result[0].options[0].isDefault).toBe(true);
    expect(result[0].options[1].isDefault).toBe(false);
  });
});

describe("selections and pricing", () => {
  it("selects the default option of every group", () => {
    const groups = createDefaultVariantGroups({ isPhotoCake: true });
    const selections = getDefaultVariantSelections(groups);

    expect(Object.keys(selections)).toHaveLength(2);
    expect(selections[groups[0].id]).toBe(groups[0].options[0].id);
  });

  it("sums the price adjustments of the selected options", () => {
    const groups = createDefaultVariantGroups({ isPhotoCake: true });
    const selections = {
      [groups[0].id]: groups[0].options[1].id, // Eggless +80
      [groups[1].id]: groups[1].options[1].id, // Custom photo print +250
    };

    expect(calculateVariantAdjustment(groups, selections)).toBe(330);
  });

  it("falls back to the default option when a selection is missing", () => {
    const groups = createDefaultVariantGroups({ isEggless: true });

    // No selection passed: falls back to the default (Eggless, +80).
    expect(calculateVariantAdjustment(groups, {})).toBe(80);
  });

  it("returns null for an unknown group or option", () => {
    const groups = createDefaultVariantGroups();

    expect(getVariantOption(groups, "nope", "nope")).toBeNull();
    expect(getVariantOption(groups, groups[0].id, "nope")).toBeNull();
  });
});

describe("syncLegacyFlagsFromVariants", () => {
  it("derives isEggless from the selected egg option label", () => {
    const groups = createDefaultVariantGroups({ isEggless: true });
    const selections = getDefaultVariantSelections(groups);

    expect(syncLegacyFlagsFromVariants(groups, selections).isEggless).toBe(true);
  });

  it("reports isEggless false when Regular is selected", () => {
    const groups = createDefaultVariantGroups({ isEggless: false });
    const selections = getDefaultVariantSelections(groups);

    expect(syncLegacyFlagsFromVariants(groups, selections).isEggless).toBe(false);
  });

  it("reports isPhotoCake false when there is no photo group", () => {
    const groups = createDefaultVariantGroups({ isPhotoCake: false });

    expect(syncLegacyFlagsFromVariants(groups, getDefaultVariantSelections(groups)).isPhotoCake).toBe(
      false
    );
  });
});
