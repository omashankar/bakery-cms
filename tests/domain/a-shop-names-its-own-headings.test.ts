import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_LABELS, resolveLabels } from "@/config/business-labels";

/**
 * A shop writes everything UNDER the product description's headings and could
 * not write the headings.
 *
 * "Product Details", "Delivery Information", "Care Instructions" — the block is
 * three lists the shop fills in: its own facts under Add detail, its delivery
 * policy in Settings → Commerce, its care notes on the product. The words
 * ABOVE each list were fixed strings in the renderer, which is the same defect
 * `labelOverrides` was built for and which this project has now fixed three
 * times: a florist has no "Care Instructions", it has "Looking after your
 * flowers".
 *
 * They are labels now, in the system that already existed for exactly this,
 * with the same rule every other label has: blank means the default, so
 * clearing a box gives the preset back rather than an unnamed heading.
 *
 * The details one is DERIVED rather than fixed — it follows the shop's own
 * product noun — so a shop that types "Bouquet" gets "Bouquet Details" without
 * touching the new box at all. That is the behaviour the hard-coded version
 * had, and losing it would have been a quiet downgrade dressed up as a feature.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("the headings a shop has not named", () => {
  it("fall back to wording that suits any trade", () => {
    const labels = resolveLabels({});

    expect(labels.descriptionHeading).toBe("Product Description");
    expect(labels.deliveryHeading).toBe("Delivery Information");
    expect(labels.careHeading).toBe("Care Instructions");
  });

  it("follow the shop's own product noun for the details list", () => {
    expect(resolveLabels({}).detailsHeading).toBe(`${DEFAULT_LABELS.productWord} Details`);
    expect(resolveLabels({ productWord: "Bouquet" }).detailsHeading).toBe("Bouquet Details");
    // The plural is a different field and must not leak into the singular one.
    expect(
      resolveLabels({ productWord: "Bouquet", productWordPlural: "Bouquets" }).detailsHeading,
    ).toBe("Bouquet Details");
  });
});

describe("the headings a shop has named", () => {
  it("are used exactly as typed", () => {
    const labels = resolveLabels({
      descriptionHeading: "About this bouquet",
      detailsHeading: "What is in it",
      deliveryHeading: "How it reaches you",
      careHeading: "Looking after your flowers",
    });

    expect(labels.descriptionHeading).toBe("About this bouquet");
    expect(labels.detailsHeading).toBe("What is in it");
    expect(labels.deliveryHeading).toBe("How it reaches you");
    expect(labels.careHeading).toBe("Looking after your flowers");
  });

  it("are trimmed, so a stray space is not a heading", () => {
    expect(resolveLabels({ careHeading: "  Care at home  " }).careHeading).toBe("Care at home");
  });

  it("give the default back when the box is cleared", () => {
    /**
     * The one rule every label here shares, and the reason `resolveLabels` is
     * the only place a blank is interpreted: an admin who empties a box wants
     * the preset, not a heading with no words in it.
     */
    for (const blank of ["", "   "]) {
      const labels = resolveLabels({
        descriptionHeading: blank,
        detailsHeading: blank,
        deliveryHeading: blank,
        careHeading: blank,
        productWord: "Bouquet",
      });

      expect(labels.descriptionHeading).toBe("Product Description");
      expect(labels.detailsHeading).toBe("Bouquet Details");
      expect(labels.deliveryHeading).toBe("Delivery Information");
      expect(labels.careHeading).toBe("Care Instructions");
    }
  });
});

describe("and every gate between the box and the page", () => {
  it("is accepted by the settings validator", async () => {
    const { labelOverridesSchema } = await import(
      "@/features/settings/server/settings.validators"
    );

    const parsed = labelOverridesSchema.safeParse({
      descriptionHeading: "About this bouquet",
      detailsHeading: "What is in it",
      deliveryHeading: "How it reaches you",
      careHeading: "Looking after your flowers",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.careHeading).toBe("Looking after your flowers");
  });

  it("survives a database that cannot be reached", async () => {
    /**
     * `getServerLabels` listed its fallback field by field, so a new label was
     * missing from the failure path until a type error found it. It resolves
     * through the same function everything else does now.
     */
    const server = read("features/settings/server/labels.server.ts");

    expect(server).toContain("return resolveLabels({});");
  });

  it("has somewhere to be typed", () => {
    const page = read("apps/admin/settings/components/general-settings-page.tsx");

    for (const field of [
      "descriptionHeading",
      "detailsHeading",
      "deliveryHeading",
      "careHeading",
    ]) {
      expect(page, `${field} has no box`).toContain(`editWording({ ${field}: e.target.value })`);
      // The default shows as the placeholder, so a blank box is not a mystery.
      expect(page, `${field} shows no default`).toContain(`placeholder={labels.${field}}`);
    }
  });

  it("is what the product page actually renders", () => {
    const pdp = read("apps/website/pages/product-detail-page.tsx");

    expect(pdp).toContain("<DetailSection title={labels.descriptionHeading}>");
    expect(pdp).toContain("{labels.detailsHeading}:");
    expect(pdp).toContain("{labels.deliveryHeading}:");
    expect(pdp).toContain("{labels.careHeading}:");

    // …and none of the four is still a fixed string beside them.
    const block = pdp.slice(pdp.indexOf("<DetailSection title={labels.descriptionHeading}>"));
    expect(block).not.toContain(">Delivery Information:<");
    expect(block).not.toContain(">Care Instructions:<");
  });
});
