import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveLabels } from "@/config/business-labels";

/**
 * A shop names the heading over its own product description.
 *
 * There were FOUR of these labels for about an hour: the block title, plus one
 * each for details, delivery and care. Then six reference storefronts were read
 * one by one, and the same shop calls the same block Delivery Information on a
 * cake and Delivery DETAILS on a candle, Care Instructions on one and Care
 * DIRECTIVES on the other — and a plant has no heading at all over its first
 * list, then Benefits, Disclaimer, Do's and Dont's.
 *
 * A shop-wide word cannot be right for all of those, so three of the four went
 * back out: a heading is typed on the PRODUCT, beside the lines it heads. What
 * stays here is the title over the whole section, which names the section
 * rather than anything inside it — and it keeps the rule every label in
 * `labelOverrides` has: blank means the default, so clearing a box gives the
 * preset back rather than an unnamed heading.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the one heading that is still shop-wide", () => {
  it("falls back to wording that suits any trade", () => {
    expect(resolveLabels({}).descriptionHeading).toBe("Product Description");
  });

  it("is used exactly as typed", () => {
    expect(resolveLabels({ descriptionHeading: "About this bouquet" }).descriptionHeading).toBe(
      "About this bouquet",
    );
  });

  it("is trimmed, so a stray space is not a heading", () => {
    expect(resolveLabels({ descriptionHeading: "  About it  " }).descriptionHeading).toBe(
      "About it",
    );
  });

  it("gives the default back when the box is cleared", () => {
    /**
     * The one rule every label here shares, and the reason `resolveLabels` is
     * the only place a blank is interpreted: an admin who empties a box wants
     * the preset, not a heading with no words in it.
     */
    for (const blank of ["", "   "]) {
      expect(resolveLabels({ descriptionHeading: blank }).descriptionHeading).toBe(
        "Product Description",
      );
    }
  });
});

describe("the three that are not", () => {
  it("are gone, because a heading belongs to the product", () => {
    /**
     * `detailsHeading`, `deliveryHeading` and `careHeading` were added and then
     * superseded within the hour. Six reference storefronts were read one by
     * one and the same block is called Delivery Information on a cake and
     * Delivery DETAILS on a candle, Care Instructions on one and Care
     * DIRECTIVES on the other — by the same shop. A shop-wide word cannot be
     * right for both, so the heading is typed on the product beside the lines
     * it heads.
     */
    const labels = resolveLabels({}) as unknown as Record<string, unknown>;

    for (const gone of ["detailsHeading", "deliveryHeading", "careHeading"]) {
      expect(gone in labels, `${gone} is still a shop-wide label`).toBe(false);
    }
  });

  it("take their boxes with them", () => {
    const page = read("apps/admin/settings/components/general-settings-page.tsx");

    expect(page).toContain("editWording({ descriptionHeading: e.target.value })");
    for (const gone of ["detailsHeading", "deliveryHeading", "careHeading"]) {
      expect(page, `${gone} still has a box`).not.toContain(gone);
    }
  });
});

describe("and every gate between the box and the page", () => {
  it("is accepted by the settings validator", async () => {
    const { labelOverridesSchema } = await import(
      "@/features/settings/server/settings.validators"
    );

    const parsed = labelOverridesSchema.safeParse({ descriptionHeading: "About this bouquet" });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.descriptionHeading).toBe("About this bouquet");
  });

  it("survives a database that cannot be reached", () => {
    /**
     * `getServerLabels` listed its fallback field by field, so a new label was
     * missing from the failure path until a type error found it. It resolves
     * through the same function everything else does now.
     */
    expect(read("features/settings/server/labels.server.ts")).toContain(
      "return resolveLabels({});",
    );
  });

  it("is what the product page actually renders", () => {
    const pdp = read("apps/website/pages/product-detail-page.tsx");

    expect(pdp).toContain("<DetailSection title={labels.descriptionHeading}>");
    // …and the parts inside it read their heading off the block, not a label.
    expect(pdp).toContain("{block.heading}:");
  });
});
