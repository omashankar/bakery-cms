import { describe, expect, it } from "vitest";

import { resolveLabels } from "./business-labels.server";

describe("resolveLabels", () => {
  it("returns the bakery defaults with no overrides", () => {
    const labels = resolveLabels("bakery");
    expect(labels.productWord).toBe("Cake");
    expect(labels.productWordPlural).toBe("Cakes");
  });

  it("returns per-business-type defaults", () => {
    expect(resolveLabels("flower-shop").productWordPlural).toBe("Flowers");
    expect(resolveLabels("restaurant").collectionsTitle).toBe("Our Menu");
  });

  it("applies admin overrides on top of defaults", () => {
    const labels = resolveLabels("bakery", { productWord: "Cupcake", productWordPlural: "Cupcakes" });
    expect(labels.productWord).toBe("Cupcake");
    expect(labels.productWordPlural).toBe("Cupcakes");
    // Untouched fields keep the default.
    expect(labels.collectionsTitle).toBe("Our Collections");
  });

  it("ignores blank overrides (falls back to default)", () => {
    const labels = resolveLabels("bakery", { productWord: "   " });
    expect(labels.productWord).toBe("Cake");
  });
});
