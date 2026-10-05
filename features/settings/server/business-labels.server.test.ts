import { describe, expect, it } from "vitest";

import { resolveLabels } from "./business-labels.server";
import { DEFAULT_LABELS } from "@/config/business-labels";

/**
 * This file used to assert that ten business types each produced their own
 * nouns — "Bouquet" for a flower shop, "Dish" for a restaurant — from a closed
 * enum in Settings. The enum is gone: it restricted nothing, it had to grow a
 * row every time a shop was a trade nobody had listed, and a shop selling cakes
 * AND chargers had no honest value to pick.
 *
 * What is left is the rule that always mattered and was never really about the
 * enum: the shop's own word wins, and a blank one means "use the default"
 * rather than "use an empty label".
 */

describe("resolving the wording a shop shows", () => {
  it("uses the shop's own word", () => {
    expect(resolveLabels({ productWord: "Bouquet", productWordPlural: "Flowers" })).toMatchObject({
      productWord: "Bouquet",
      productWordPlural: "Flowers",
    });
  });

  it("falls back per field, not all-or-nothing", () => {
    const labels = resolveLabels({ productWord: "Bouquet" });

    expect(labels.productWord).toBe("Bouquet");
    expect(labels.productWordPlural).toBe(DEFAULT_LABELS.productWordPlural);
  });

  it("treats blank and whitespace as no opinion", () => {
    // An admin clearing the box gets the default back, not a nameless button.
    const labels = resolveLabels({ productWord: "   ", collectionsTitle: "" });

    expect(labels.productWord).toBe(DEFAULT_LABELS.productWord);
    expect(labels.collectionsTitle).toBe(DEFAULT_LABELS.collectionsTitle);
  });

  it("answers with the defaults when a shop has said nothing at all", () => {
    expect(resolveLabels()).toMatchObject({
      productWord: DEFAULT_LABELS.productWord,
      productWordPlural: DEFAULT_LABELS.productWordPlural,
      collectionsTitle: DEFAULT_LABELS.collectionsTitle,
    });
  });

  it("does not name a trade in its defaults", () => {
    /**
     * The point of removing the enum. A default of "Cake" is the same bug the
     * ten presets were — one row instead of ten — and it is what every shop
     * that has not typed a word yet is shown.
     */
    const labels = resolveLabels();

    expect(labels.productWord.toLowerCase()).not.toContain("cake");
    expect(labels.productWordPlural.toLowerCase()).not.toContain("cake");
    expect(labels.collectionsSubtitle.toLowerCase()).not.toContain("cake");
  });
});
