/**
 * A module the shop has switched off must not appear on the bill.
 *
 * Turning Egg/Eggless or Photo Cake off hid the PICKER and nothing else — the
 * product page's own comment said so: "the group stays in the data + pricing".
 * So a shop with Egg/Eggless off still charged every eggless cake its +₹80
 * default option and still stamped "Egg preference: Eggless" on the order line,
 * the invoice and the confirmation email, for a choice the customer was never
 * shown and a feature the shop had turned off.
 *
 * Not sending the selection is not enough on its own:
 * `calculateVariantAdjustment` falls back to a group's default option whenever
 * no selection is given, so the surcharge survives an empty selection map. The
 * GROUP has to be gone, and that decision belongs to the server.
 *
 * The flavour and shape pickers on the same page were already gated for exactly
 * this reason — "an order line must not record a choice the customer was never
 * shown". These two were the ones left behind.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  calculateVariantAdjustment,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import { calculateProductUnitPrice } from "@/features/products/lib/product-pricing";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import type { ProductVariantGroup } from "@/types/product";

const egg = {
  id: "egg",
  name: "Egg preference",
  type: "egg",
  required: true,
  options: [
    { id: "regular", label: "Regular", priceAdjustment: 0, isDefault: false },
    { id: "eggless", label: "Eggless", priceAdjustment: 80, isDefault: true, semantic: "eggless" },
  ],
} as unknown as ProductVariantGroup;

const photo = {
  id: "photo",
  name: "Photo cake",
  type: "photo",
  required: false,
  options: [
    { id: "standard", label: "Standard design", priceAdjustment: 0, isDefault: false },
    { id: "print", label: "Custom photo print", priceAdjustment: 250, isDefault: true },
  ],
} as unknown as ProductVariantGroup;

const size = {
  id: "tier",
  name: "Tiers",
  type: "custom",
  required: false,
  options: [{ id: "one", label: "Single tier", priceAdjustment: 0, isDefault: true }],
} as unknown as ProductVariantGroup;

describe("the groups a shop with these modules sells", () => {
  it("keeps everything when every module is on", () => {
    expect(variantGroupsEnabledBy([egg, photo, size], defaultModuleSettings)).toHaveLength(3);
  });

  it("drops the egg group when Egg/Eggless is off", () => {
    const kept = variantGroupsEnabledBy([egg, photo, size], {
      ...defaultModuleSettings,
      eggEggless: false,
    });

    expect(kept.map((group) => group.id)).toEqual(["photo", "tier"]);
  });

  it("drops the photo group when Photo Cake is off", () => {
    const kept = variantGroupsEnabledBy([egg, photo, size], {
      ...defaultModuleSettings,
      photoCake: false,
    });

    expect(kept.map((group) => group.id)).toEqual(["egg", "tier"]);
  });

  it("never drops a group the modules have nothing to say about", () => {
    const kept = variantGroupsEnabledBy([size], {
      ...defaultModuleSettings,
      eggEggless: false,
      photoCake: false,
    });

    expect(kept).toEqual([size]);
  });
});

describe("what the shop charges", () => {
  it("stops charging the surcharge once the module is off", () => {
    const priced = (groups: ProductVariantGroup[]) =>
      calculateProductUnitPrice({ basePrice: 1099, variantGroups: groups, variantSelections: {} });

    expect(priced([egg])).toBe(1179);
    expect(
      priced(variantGroupsEnabledBy([egg], { ...defaultModuleSettings, eggEggless: false })),
    ).toBe(1099);
  });

  it("is not fixed by omitting the selection, which is why the group must go", () => {
    // The reason the gate cannot live on the client alone: an empty selection
    // map still resolves to the group's default option.
    expect(calculateVariantAdjustment([egg], {})).toBe(80);
  });
});

describe("where the gate is applied", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("prices a cart through it, which is the only place that stops the charge", () => {
    const pricing = read("features/checkout/server/pricing.server.ts");

    expect(pricing).toContain("variantGroupsEnabledBy(getProductVariantGroups(product), modules)");
    // Read per quote from the shop's settings, not passed in by the caller.
    expect(pricing).toContain("settings.modules");
  });

  it("prices a catalogue card through it, so the card and the shop still agree", () => {
    const service = read("features/products/data/products-service.ts");

    expect(service).toContain("variantGroupsEnabledBy(product.variantGroups ?? [], modules)");
  });

  it("records only the selections the customer could see", () => {
    const page = read("apps/website/pages/product-detail-page.tsx");

    expect(page).toContain("variantGroupsEnabledBy(variantGroups, modules)");

    /**
     * Scoped to the add-to-cart call.
     *
     * `variantSelections: visibleSelections` also appears in the price
     * calculation further up, so an unscoped search for it passed with the
     * add-to-cart site reverted — the string was still in the file, just not
     * where it mattered.
     */
    const handler = page.slice(page.indexOf("const handleAddToCart"));
    const body = handler.slice(0, handler.indexOf("toast.success"));

    expect(body).toContain("variantSelections: visibleSelections");
    expect(body, "the order records every group, including hidden ones").not.toMatch(
      /^\s*variantSelections,\s*$/m,
    );
  });

  it("defaults to every module ON, so an older settings document prices as before", () => {
    expect(defaultModuleSettings.eggEggless).toBe(true);
    expect(defaultModuleSettings.photoCake).toBe(true);

    for (const path of [
      "features/checkout/server/pricing.server.ts",
      "features/products/data/products-service.ts",
    ]) {
      expect(read(path)).toContain("...defaultModuleSettings");
    }
  });
});

describe("the photo a photo cake is printed with", () => {
  it("is not collected by a control that throws it away", () => {
    // The file input kept the file NAME in local state and nothing else. It was
    // never uploaded, never reached the cart line or the order, and the bakery
    // got an order for a photo cake with no photo — after the customer had paid
    // the photo surcharge and watched themselves attach it.
    const page = readFileSync(
      join(process.cwd(), "apps/website/pages/product-detail-page.tsx"),
      "utf8",
    );

    expect(page).not.toContain('id="photo-upload"');
    expect(page).not.toContain("setPhotoName");
    // And it says what does happen instead.
    expect(page).toContain("collect the");
  });
});
