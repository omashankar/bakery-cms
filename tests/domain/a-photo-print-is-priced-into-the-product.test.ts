import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { variantGroupsEnabledBy } from "@/features/products/lib/variant-utils";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import type { ProductVariantGroup } from "@/types/product";

/**
 * A photo print was an OPTION a customer chose between — "Standard design" free,
 * "Custom photo print" +₹250 — and the uploader appeared once they had picked
 * the dear one. It is not an option any more.
 *
 * The shop's reasoning: if a product takes a photograph, it takes one. There is
 * no cheaper version of it to choose between, and what printing costs is part of
 * what the thing costs — so the shop ticks "Allow photo upload" and prices the
 * product accordingly. One tick is the whole statement.
 *
 * That took a typed variant group, an option `semantic`, a derived product flag
 * and the last two functions that read what an option MEANT with it. What is
 * left is a group with a label and a price, which is all a group ever needed to
 * be.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * The same file with its comments taken out.
 *
 * Every removal in this repo leaves a tombstone naming what went — which means
 * an unstripped search for the removed string matches the EXPLANATION rather
 * than the code, and the guard passes for the thing it forbids.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("what a shop does now", () => {
  const FORM = "apps/admin/products/components/product-form-page.tsx";

  it("keeps the one tick that turns the uploader on", () => {
    expect(read(FORM)).toContain("Allow photo upload on PDP");
  });

  it("no longer builds a priced option group behind that tick", () => {
    /**
     * The tick used to ADD a group — and remove it again on untick — because
     * the flag beside it was derived from whether the group existed. Two
     * controls kept in step with each other, for a choice the customer did not
     * have.
     */
    const form = code(FORM);

    expect(form.length).toBeGreaterThan(1000);
    expect(form).not.toContain("Custom photo print");
    expect(form).not.toContain("Standard design");
    expect(form).not.toContain("isPhotoCake");
  });

  it("shows the uploader on the product's own say-so alone", () => {
    /**
     * It read `allowsPhotoUpload === true || selectedPhotoOption?.semantic ===
     * "photo-print"` — either the product's flag OR the paid option having been
     * chosen. There is no option to choose, so there is one condition left.
     */
    const page = read("apps/website/pages/product-detail-page.tsx");

    expect(page).toContain("const showPhotoUpload = cake.allowsPhotoUpload === true");
    expect(page).not.toContain("selectedPhotoOption");
  });

  it("selects the homepage photo row on the same field the uploader reads", () => {
    // It selected on `isPhotoCake`, a second flag meaning the same thing.
    expect(read("features/products/lib/homepage-rails.ts")).toContain(
      "published.filter((cake) => cake.allowsPhotoUpload)",
    );
  });
});

describe("the special case is gone from the type system", () => {
  it("leaves shape as the only typed group", async () => {
    /**
     * `type` exists so a MODULE can hide a group. Egg went, photo has gone, and
     * shape is the last one a switch still gates — everything else a shop makes
     * is `custom`, which is to say ordinary.
     */
    const source = read("types/product.ts");

    expect(source).toContain(
      'export type ProductVariantGroupType = "shape" | "custom";',
    );
    // …and the product carries ONE field about photographs, not two saying
    // the same thing.
    expect(code("types/product.ts")).not.toContain("isPhotoCake");
    expect(code("types/product.ts")).toContain("allowsPhotoUpload: boolean;");
  });

  it("gives an option nothing to mean beyond its label and its price", async () => {
    /**
     * `VariantOptionSemantic` was the machine-readable meaning an option could
     * carry so logic branched on it rather than on a merchant's wording. Both
     * of its values were bakery special cases and both have gone, so the field
     * and the three helpers that read it have gone with them.
     */
    const utils = await import("@/features/products/lib/variant-utils");

    for (const gone of [
      "offersSemantic",
      "backfillLegacyGroups",
      "syncLegacyFlagsFromVariants",
      "createDefaultVariantGroups",
    ]) {
      expect(gone in utils, `${gone} is still exported`).toBe(false);
    }
    expect(code("types/product.ts")).not.toContain("VariantOptionSemantic");
  });

  it("no longer refuses a product for omitting a flag that does not exist", async () => {
    // It was a REQUIRED boolean, so anything posting a product without it got
    // a 400 — an import, a seed, an API client.
    const { productFormSchema } = await import("@/features/products/server/product.validators");

    expect("isPhotoCake" in productFormSchema.shape).toBe(false);
    expect("allowsPhotoUpload" in productFormSchema.shape).toBe(true);
  });

  it("is not carried by Mongoose either", async () => {
    const { ProductModel } = await import("@/lib/server/db/models/product.model");
    const doc = new ProductModel({
      _id: "p-frame",
      name: "Photo frame",
      slug: "photo-frame",
      isPhotoCake: true,
      allowsPhotoUpload: true,
    });

    const stored = doc.toObject() as { isPhotoCake?: boolean; allowsPhotoUpload?: boolean };

    expect(stored.isPhotoCake).toBeUndefined();
    expect(stored.allowsPhotoUpload).toBe(true);
  });
});

describe("a stored photo group still behaves", () => {
  /**
   * `variantGroups` is Mixed in Mongo and the validator types `type` as a plain
   * string, so a product saved with a photo group keeps it. It must go on being
   * priced and shown like any other group — what must NOT survive is a filter
   * hiding it for a reason that no longer applies.
   */
  const stored = {
    id: "g-photo",
    name: "Photo cake",
    type: "photo",
    required: false,
    options: [
      { id: "plain", label: "Standard design", priceAdjustment: 0, isDefault: true },
      { id: "print", label: "Custom photo print", priceAdjustment: 250, isDefault: false },
    ],
  } as unknown as ProductVariantGroup;

  it("is kept whatever the modules say", () => {
    expect(variantGroupsEnabledBy([stored], defaultModuleSettings)).toEqual([stored]);
    expect(
      variantGroupsEnabledBy([stored], { ...defaultModuleSettings, shape: false }),
    ).toEqual([stored]);
  });
});
