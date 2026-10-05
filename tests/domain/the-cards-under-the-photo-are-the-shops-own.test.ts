import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT_TRUST_ICONS, productTrustIcon } from "@/config/product-trust-icons";

/**
 * The row of cards under the product photo.
 *
 * The reference storefront shows three: "100% Purchase Protection / Assured
 * Quality Secure Payments", "Serving Excellence / 20M Happy Customers + 100%
 * Satisfaction!", "Timely Delivery / Different Time Slots Available". Every one
 * is a claim, and two of the three are numbers this software has no way to
 * know — the same shape as the "2000+ reviews" and "1M+ Happy customers" this
 * project has already deleted from the homepage twice.
 *
 * So the row was two cards hard-coded into the page. One of them, "Free message
 * card / Written as you ask", was two English sentences a shop selling anything
 * but cake could not change.
 *
 * The shop writes them now. The DELIVERY card is the exception and stays in the
 * page: it is not copy, it renders the shop's own `deliveryLeadDays`, so it says
 * "Same-day delivery" the day the shop changes its lead time and cannot go
 * stale the way a typed sentence can.
 *
 * A shop that has written nothing gets that one card — not a boast invented for
 * it, and not an empty row.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/**
 * The same file with its comments taken out.
 *
 * Every removal here leaves a tombstone quoting what went — the one above this
 * row included — so an unstripped search for the removed sentence matches the
 * EXPLANATION and the guard passes for the thing it forbids.
 */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("what a shop starts with", () => {
  it("is no cards at all", async () => {
    const { defaultCommerceSettings } = await import("@/features/settings/lib/settings-utils");

    expect(defaultCommerceSettings.productTrustCards).toEqual([]);
  });

  it("still shows the delivery card, because that one is read not written", () => {
    const page = read("apps/website/pages/product-detail-page.tsx");

    expect(page).toContain("{deliveryPromise ? (");
    expect(page).toContain("Timely Delivery");
  });

  it("no longer hard-codes a card a shop cannot change", () => {
    const page = code("apps/website/pages/product-detail-page.tsx");

    expect(page).not.toContain("Written as you ask");
    expect(page).not.toContain("Free message card");
  });
});

describe("what a shop writes", () => {
  it("reaches the page through the settings it typed", () => {
    const page = read("apps/website/pages/product-detail-page.tsx");

    expect(page).toContain("(commerce.productTrustCards ?? [])");
    expect(page).toContain("productTrustIcon(card.icon)");
  });

  it("drops a card with no title, and a subtitle it did not write", () => {
    /**
     * A half-typed row is normal in an admin form, and an empty box under a
     * heading is the thing this page keeps deleting.
     */
    const page = read("apps/website/pages/product-detail-page.tsx");

    expect(page).toContain(".filter((card) => card.title.trim().length > 0)");
    expect(page).toContain("{card.subtitle.trim() ? (");
  });

  it("has somewhere to be typed", () => {
    const admin = read("apps/admin/settings/components/commerce-settings-page.tsx");
    const editor = read("apps/admin/settings/components/product-trust-cards-fields.tsx");

    // The whole tag, not a prefix of it: `<ProductTrustCardsFieldsGone` starts
    // with `<ProductTrustCardsFields`, so a substring check passes for a
    // component that is no longer the one being rendered.
    expect(admin).toMatch(/<ProductTrustCardsFields\s/);
    expect(admin).toContain('import { ProductTrustCardsFields } from "./product-trust-cards-fields";');
    expect(admin).toContain("value={settings.productTrustCards ?? []}");
    // Order is what the customer reads, so the shop can set it.
    expect(editor).toContain("function move(index: number, by: -1 | 1)");
  });
});

describe("the icon, which is a name and not a component", () => {
  it("resolves every name the picker offers", () => {
    for (const name of Object.keys(PRODUCT_TRUST_ICONS)) {
      expect(productTrustIcon(name), `${name} does not resolve`).toBeTruthy();
      expect(productTrustIcon(name)).toBe(PRODUCT_TRUST_ICONS[name]);
    }
  });

  it("never returns undefined for a name that has since gone", () => {
    /**
     * A settings document written before a name was removed from the list would
     * otherwise render `<undefined />`, which React throws on — taking down the
     * whole product page over a decoration.
     */
    for (const gone of ["", "Cake", "SomethingRemovedLater"]) {
      expect(productTrustIcon(gone)).toBeTruthy();
    }
  });

  it("names no trade, so the list suits a shop selling anything", () => {
    expect(Object.keys(PRODUCT_TRUST_ICONS)).not.toContain("Cake");
  });
});

describe("and every gate between the box and the page", () => {
  it("is a Mongoose path, so what the admin types can be saved", async () => {
    /**
     * `sameDayCutoff` and `productImageNote` were declared, validated, and had a
     * field on this very screen — and were never Mongoose paths, so strict mode
     * dropped both on every write and neither could ever be set.
     */
    const { SettingsModel } = await import("@/lib/server/db/models/settings.model");
    const doc = new SettingsModel({
      commerce: {
        productTrustCards: [
          { id: "c1", icon: "Truck", title: "Hand delivered", subtitle: "By our own team" },
        ],
      },
    });

    const stored = doc.toObject() as {
      commerce: { productTrustCards?: { title?: string }[] };
    };

    expect(stored.commerce.productTrustCards).toHaveLength(1);
    expect(stored.commerce.productTrustCards?.[0]?.title).toBe("Hand delivered");
  });

  it("refuses a card with nothing to say, and allows one with no second line", async () => {
    const { commerceSchema } = await import("@/features/settings/server/settings.validators");
    const base = (await import("@/features/settings/lib/settings-utils")).defaultCommerceSettings;

    const withTitleOnly = commerceSchema.safeParse({
      ...base,
      productTrustCards: [{ id: "c1", icon: "Heart", title: "Secure payments", subtitle: "" }],
    });
    expect(withTitleOnly.success).toBe(true);

    const untitled = commerceSchema.safeParse({
      ...base,
      productTrustCards: [{ id: "c1", icon: "Heart", title: "", subtitle: "Something" }],
    });
    expect(untitled.success, "a card with no title is a box with nothing in it").toBe(false);

    const notEvenAList = commerceSchema.safeParse({ ...base, productTrustCards: "hello" });
    expect(notEvenAList.success).toBe(false);
  });
});
