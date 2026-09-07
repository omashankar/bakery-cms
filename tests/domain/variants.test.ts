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
  createVariantGroup,
  createVariantOption,
  getDefaultVariantSelections,
  getVariantOption,
  normalizeVariantGroups,
} from "@/features/products/lib/variant-utils";

const finish = () => [
  createVariantGroup(
    "Finish",
    "custom",
    [
      createVariantOption("Plain", 0, true),
      createVariantOption("Gold leaf", 250, false),
    ],
    false,
  ),
];

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
  it("leaves a group nobody has answered alone", () => {
    /**
     * This promoted the first option, which made every group mandatory the
     * moment it was created: a shop could add “Eggless +₹80” and the page would
     * charge for it before anybody ticked anything. No default is now a state
     * the model supports — it is how an opt-in add-on is described.
     */
    const group = createVariantGroup("Size", "custom", [
      createVariantOption("Small"),
      createVariantOption("Large"),
    ]);

    expect(group.options.some((option) => option.isDefault)).toBe(false);
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

/*
  `createDefaultVariantGroups` stood here, with three cases.

  It built an "Egg preference" group on every product a shop created, then
  only a "Photo cake" one, then nothing at all — at which point there was no
  function left. A shop names its own option groups; the two it used to build
  for free were both bakery special cases, and both are ordinary options now
  or nothing at all.
*/

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

    const result = normalizeVariantGroups({ variantGroups: existing });

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
     * `isEggless: true` was the strongest case: the old fallback made Eggless
     * the DEFAULT option, so the product silently cost 80 more than its own
     * record said. Absent is the honest answer, and there is no longer any
     * function that builds a group nobody asked for.
     */
    const result = normalizeVariantGroups({ variantGroups: [] });

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
    });

    expect(result[0].options[0].isDefault).toBe(true);
    expect(result[0].options[1].isDefault).toBe(false);
  });
});

describe("selections and pricing", () => {
  it("selects the default option of every group", () => {
    const groups = finish();
    const selections = getDefaultVariantSelections(groups);

    expect(Object.keys(selections)).toHaveLength(1);
    expect(selections[groups[0].id]).toBe(groups[0].options[0].id);
  });

  it("sums the price adjustments of the selected options", () => {
    const groups = [
      ...finish(),
      {
        id: "g-wrap",
        name: "Wrapping",
        type: "custom" as const,
        required: false,
        options: [
          { id: "none", label: "None", priceAdjustment: 0, isDefault: true },
          { id: "gift", label: "Gift box", priceAdjustment: 80, isDefault: false },
        ],
      },
    ];
    const selections = {
      [groups[0].id]: groups[0].options[1].id, // Gold leaf +250
      [groups[1].id]: "gift", // +80
    };

    expect(calculateVariantAdjustment(groups, selections)).toBe(330);
  });

  it("falls back to the default option when a selection is missing", () => {
    // No selection passed: falls back to the default, which here is the free
    // one — an option nobody has ticked costs nothing.
    expect(calculateVariantAdjustment(finish(), {})).toBe(0);
  });

  it("returns null for an unknown group or option", () => {
    const groups = finish();

    expect(getVariantOption(groups, "nope", "nope")).toBeNull();
    expect(getVariantOption(groups, groups[0].id, "nope")).toBeNull();
    // …and finds one that IS there, so the two above cannot pass on an
    // empty list.
    expect(getVariantOption(groups, groups[0].id, groups[0].options[0].id)).not.toBeNull();
  });
});

/*
  `syncLegacyFlagsFromVariants` stood here. It derived two product flags from
  what an option MEANT — isEggless and isPhotoCake — and both are gone with the
  semantics they read. A shop states what a product is; the options state what
  a customer can choose and what it costs.
*/
