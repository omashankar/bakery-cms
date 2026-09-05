import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  asAddOn,
  createDefaultVariantGroups,
  syncLegacyFlagsFromVariants,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import type { ProductVariantGroup } from "@/types/product";

/**
 * Eggless was a special case with a type, a semantic, a module and a flag of its
 * own. It is an option with a price now, like every other.
 *
 * The shop's argument, and it is a good one: a customer who wants eggless gets a
 * TICKBOX — which any two-option group already renders as — so the machinery
 * around it bought nothing. And a product that IS eggless is a claim about a
 * recipe: the shop makes it in the name and the description, where it can be
 * worded and qualified, rather than in a boolean this software derives from an
 * option label and then paints as a badge.
 *
 * What that costs is real and is recorded here so nobody rediscovers it as a
 * bug: nothing on a product says machine-readably that it is eggless any more,
 * so the "Eggless only" tick on Collections, the leaf badge, the "Made without
 * eggs" card and the homepage Eggless rail have all gone with it. Searching the
 * name and description is what remains.
 */

const eggless = (extra = 80): ProductVariantGroup =>
  ({
    id: "g-egg",
    name: "Egg preference",
    type: "custom",
    required: false,
    options: [
      { id: "regular", label: "Regular", priceAdjustment: 0, isDefault: true },
      { id: "eggless", label: "Eggless", priceAdjustment: extra, isDefault: false },
    ],
  }) as ProductVariantGroup;

describe("what a shop does instead", () => {
  it("offers eggless as a tickbox with a price, from an ordinary group", () => {
    /**
     * THE replacement, and the reason the special case could go. `asAddOn` does
     * not look at `group.type` at all — any two-option group whose second option
     * costs more collapses to one tickbox that starts unticked.
     */
    const addOn = asAddOn(eggless());

    expect(addOn).not.toBeNull();
    expect(addOn?.on.label).toBe("Eggless");
    expect(addOn?.extra).toBe(80);
    // Unticked until the customer ticks it: the free option is the default.
    expect(addOn?.off?.label).toBe("Regular");
  });

  it("charges nothing until it is ticked", () => {
    expect(asAddOn(eggless(0))).toBeNull();
  });
});

describe("the special case is gone", () => {
  it("starts a new product with no egg question on it", () => {
    // Every product a shop created opened with an "Egg preference" row — a
    // bakery question asked of a phone charger.
    expect(createDefaultVariantGroups()).toEqual([]);
  });

  it("no longer derives a flag from what an option means", () => {
    const flags = syncLegacyFlagsFromVariants([eggless()]);

    expect(Object.keys(flags)).toEqual(["isPhotoCake"]);
  });

  it("does not gate a group behind a module that no longer exists", () => {
    /**
     * A stored `type: "egg"` group survives this change — `variantGroups` is
     * Mixed in Mongo and the validator types `type` as a plain string, so the
     * 25 products carrying one keep it, priced and summarised like any other
     * group. What must NOT survive is a filter that hides it for a module
     * nobody can switch.
     */
    const stored = { ...eggless(), type: "egg" } as unknown as ProductVariantGroup;

    expect(variantGroupsEnabledBy([stored], defaultModuleSettings)).toEqual([stored]);
    expect(
      variantGroupsEnabledBy([stored], { ...defaultModuleSettings, photoCake: false, shape: false }),
    ).toEqual([stored]);
  });

  it("leaves the shop five module switches, not six", async () => {
    const { modulesSchema } = await import("@/features/settings/server/settings.validators");

    expect(Object.keys(modulesSchema.shape).sort()).toEqual([
      "flavour",
      "photoCake",
      "shape",
      "weddingBuilder",
      "weight",
    ]);
  });

  it("keeps no pre-paint CSS gate for a module that is gone", () => {
    /**
     * The module had THREE homes beyond its key: a string inside the blocking
     * script, its twin in the hydrated pass, and a selector in globals.css. A
     * leftover selector is a rule that matches nothing and reads as live.
     */
    const script = readFileSync(join(process.cwd(), "lib/business-blocking.ts"), "utf8");
    const applied = readFileSync(
      join(process.cwd(), "components/business-blocking-script.tsx"),
      "utf8",
    );
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    for (const [name, source] of [
      ["blocking script", script],
      ["hydrated pass", applied],
      ["globals.css", css],
    ] as const) {
      expect(source, name).not.toContain("data-mod-egg");
    }
    // …and the four that remain still do their job.
    expect(script).toContain("data-mod-photo");
    expect(css).toContain("data-gate-photo");
  });
});

describe("what the shop loses, stated rather than discovered", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("no longer offers an Eggless only tick, because nothing records the property", () => {
    /**
     * This is the one thing the flavour and size removals did not cost. Those
     * rewired their option list to read the products, because the products
     * still carried `flavourOptions` and `weights`. Nothing carries "this is
     * eggless" any more — only an option label that may say anything — so a
     * cross-catalogue filter for it cannot be honest.
     */
    const filters = read("apps/website/lib/collection-filters.ts");
    const panel = read("components/storefront/collection-filters-panel.tsx");

    expect(filters).not.toContain("egglessOnly");
    expect(panel).not.toContain("Eggless only");
    // The tick beside it is untouched — this removed one preference, not the group.
    expect(panel).toContain("In stock only");
  });

  it("no longer claims on a product page that something is made without eggs", () => {
    /**
     * Comments stripped first. The tombstones explaining what was removed name
     * the very strings this forbids — an unstripped search matches the
     * explanation rather than the code, which is the exact way a guard passes
     * for the thing it forbids.
     */
    const page = read("apps/website/pages/product-detail-page.tsx")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^[ \t]*\/\/.*$/gm, "");

    expect(page).not.toContain("Made without eggs");
    expect(page).not.toContain("prepared without eggs");
    // …and the file is still the product page, not an empty string.
    expect(page).toContain("Add to Cart");
  });

  it("no longer projects a flag onto every card that nothing reads", () => {
    // `toCard` carries a deliberate handful of fields, each because a filter
    // reads it. No filter reads this one any more.
    const source = read("features/products/data/products-service.ts");
    const start = source.indexOf("function toCard(");
    const fn = source.slice(start, source.indexOf("\n}", start));

    expect(fn.length).toBeGreaterThan(200);
    expect(fn).not.toContain("isEggless");
    expect(fn).toContain("occasions: product.occasions");
  });

  it("no longer heads a homepage row it cannot fill", () => {
    /**
     * The rail selected on the flag alone. Left standing, it would have padded
     * itself from the whole catalogue under the heading "100% Eggless" — cakes
     * with eggs in them, advertised as having none.
     */
    expect(read("constants/section-registry.ts")).not.toContain('type: "eggless"');
    expect(read("features/products/lib/homepage-rails.ts")).not.toContain("eggless");
  });

  it("still finds them the way a customer would type it", () => {
    // The shop's own words are what is left, and they are searchable. The four
    // demo products are named for it.
    const demo = read("constants/landing-data.ts");

    expect(demo).toContain("Eggless Chocolate Fudge");
    expect(demo).toContain("100% eggless");
  });
});
