import { describe, expect, it } from "vitest";

import { DEFAULT_LABELS, resolveLabels } from "@/config/business-labels";
import { labelOverridesSchema } from "@/features/settings/server/settings.validators";

/**
 * A SHOP NAMES ITS OWN THREE LISTS.
 *
 * "Category", "Occasion" and "Collection" were hardcoded English on the one
 * screen whose whole job is letting a shop describe its goods — while the word
 * for the goods themselves has been editable since the labels shipped. A phone
 * shop files under Brands, a florist sells for Festivals, a bookshop curates
 * Staff Picks, and none of them were choosing between three fixed nouns.
 *
 * Two halves are pinned here, and the second is the one that breaks quietly.
 * `resolveLabels` decides what a blank means; `labelOverridesSchema` decides
 * whether the shop's answer survives the journey to the database at all.
 */

describe("the words a shop uses for its catalog", () => {
  it("come back as typed", () => {
    const labels = resolveLabels({
      categoryWord: "Brand",
      categoryWordPlural: "Brands",
      occasionWord: "Festival",
      occasionWordPlural: "Festivals",
      collectionWord: "Edit",
      collectionWordPlural: "Edits",
    });

    expect(labels).toMatchObject({
      categoryWord: "Brand",
      categoryWordPlural: "Brands",
      occasionWord: "Festival",
      occasionWordPlural: "Festivals",
      collectionWord: "Edit",
      collectionWordPlural: "Edits",
    });
  });

  it("fall back one field at a time, not all or nothing", () => {
    /*
      A shop renaming its categories has said nothing about its occasions, and
      a fallback that switched wholesale would rename those too.
    */
    const labels = resolveLabels({ categoryWord: "Brand" });

    expect(labels.categoryWord).toBe("Brand");
    expect(labels.categoryWordPlural).toBe(DEFAULT_LABELS.categoryWordPlural);
    expect(labels.occasionWord).toBe(DEFAULT_LABELS.occasionWord);
    expect(labels.collectionWordPlural).toBe(DEFAULT_LABELS.collectionWordPlural);
  });

  it("and a box left blank means the default, not an empty heading", () => {
    const labels = resolveLabels({ categoryWord: "   ", occasionWordPlural: "" });

    expect(labels.categoryWord).toBe(DEFAULT_LABELS.categoryWord);
    expect(labels.occasionWordPlural).toBe(DEFAULT_LABELS.occasionWordPlural);
  });

  it("are neutral by default — the floor names no trade", () => {
    /*
      The neutral floor is the thing this whole layer exists for: a default
      that says "Flavour" or "Cake" is the same bug in one row instead of ten.
    */
    const floor = [
      DEFAULT_LABELS.categoryWord,
      DEFAULT_LABELS.categoryWordPlural,
      DEFAULT_LABELS.occasionWord,
      DEFAULT_LABELS.occasionWordPlural,
      DEFAULT_LABELS.collectionWord,
      DEFAULT_LABELS.collectionWordPlural,
    ].join(" ");

    expect(floor.toLowerCase()).not.toMatch(/cake|bakery|flower|bouquet/);
  });
});

describe("and the shop's answer survives being saved", () => {
  /*
    THE HALF THAT FAILS SILENTLY. `labelOverridesSchema` has no `.passthrough()`
    — deliberately, so a typo is refused rather than stored — which means a
    field the type declares and the schema does not is STRIPPED on write while
    the API answers 200. The admin re-renders its own state and looks saved.
    This repo has hit that failure four times; adding six boxes to the settings
    form without adding them here would have been the fifth.
  */
  it("keeps every catalog word the form can send", () => {
    const typed = {
      categoryWord: "Brand",
      categoryWordPlural: "Brands",
      occasionWord: "Festival",
      occasionWordPlural: "Festivals",
      collectionWord: "Edit",
      collectionWordPlural: "Edits",
    };

    const parsed = labelOverridesSchema.parse(typed);

    for (const [key, value] of Object.entries(typed)) {
      expect(parsed[key as keyof typeof parsed], `${key} was dropped on the way to the database`).toBe(
        value,
      );
    }
  });

  it("alongside the ones that were already there", () => {
    const parsed = labelOverridesSchema.parse({
      productWord: "Bouquet",
      categoryWord: "Brand",
    });

    expect(parsed.productWord).toBe("Bouquet");
    expect(parsed.categoryWord).toBe("Brand");
  });
});
