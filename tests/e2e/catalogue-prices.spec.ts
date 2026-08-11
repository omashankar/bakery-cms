import { expect, test } from "@playwright/test";

import { connect } from "./shop-state";

/**
 * A grid card and the product page it links to have to agree about the price —
 * and the one they agree on has to be the one the shop charges.
 *
 * `product.price` is the BASE. With nothing selected the server still applies
 * each variant group's default option, and this shop's four eggless cakes
 * default to an "Eggless" option that adds ₹80. The cards showed ₹1,099 and
 * the shop charged ₹1,179, so adding one from a grid produced "Prices have
 * changed" at the last step of checkout — for a choice never made.
 *
 * The product page has always priced this correctly. Only the card was wrong,
 * which is why nothing but a comparison between the two would catch it.
 */

/** "₹1,179" → 1179 */
function rupees(text: string | null): number {
  return Number((text ?? "").replace(/[^\d]/g, ""));
}

test.describe("what a catalogue card says a cake costs", () => {
  test("matches the product page for a cake with a paid default option", async ({ page }) => {
    // A product whose DEFAULT variant option costs money. Without one of these
    // in the catalogue this test would pass on a cake that has nothing to add,
    // and prove nothing.
    const db = await connect();
    const products = await db.collection("products").find({ status: "published" }).toArray();
    const withPaidDefault = products.find((product) =>
      (product.variantGroups ?? []).some((group: { options?: { isDefault?: boolean; priceAdjustment?: number }[] }) => {
        const options = group.options ?? [];
        const fallback = options.find((option) => option.isDefault) ?? options[0];
        return Number(fallback?.priceAdjustment ?? 0) > 0;
      }),
    );
    expect(
      withPaidDefault,
      "no product in this shop has a paid default option, so this test cannot prove anything",
    ).toBeTruthy();

    const surcharge = (withPaidDefault!.variantGroups as { options?: { isDefault?: boolean; priceAdjustment?: number }[] }[])
      .reduce((total, group) => {
        const options = group.options ?? [];
        const fallback = options.find((option) => option.isDefault) ?? options[0];
        return total + Number(fallback?.priceAdjustment ?? 0);
      }, 0);
    const expected = Number(withPaidDefault!.price) + surcharge;

    await page.goto(`/store/cakes/${withPaidDefault!.slug}`);
    const pagePrice = rupees(await page.getByText(/₹/).first().textContent());
    expect(pagePrice, "the product page is not charging the default surcharge").toBe(expected);

    // And the grid card, which is the one that was showing the bare base price.
    await page.goto("/store/collections/eggless");
    const card = page.locator("article").filter({ hasText: withPaidDefault!.name }).first();
    await expect(card, `${withPaidDefault!.name} is not on the eggless page`).toBeVisible();

    const cardPrice = rupees(await card.getByText(/₹/).first().textContent());
    expect(
      cardPrice,
      "the card shows the base price, so checkout will reprice this cart",
    ).toBe(expected);
  });

  test("does not offer an out-of-stock cake with a working Add to Cart", async ({ page }) => {
    const db = await connect();
    const target = await db.collection("products").findOne({ status: "published" });
    expect(target, "no published product to test with").toBeTruthy();

    const before = target!.stockStatus;
    await db
      .collection("products")
      .updateOne({ _id: target!._id }, { $set: { stockStatus: "out_of_stock" } });

    try {
      await page.goto(`/store/cakes/${target!.slug}`);
      // The product page has refused this since it was written.
      await expect(page.getByRole("button", { name: /out of stock/i }).first()).toBeVisible();

      // The card is the same action on every grid, including the wishlist. It
      // used to add the cake and toast "Added to cart", and checkout then
      // blocked on it — after the customer had filled in their address.
      await page.goto("/store/collections");
      const card = page.locator("article").filter({ hasText: target!.name }).first();
      if (await card.isVisible().catch(() => false)) {
        await expect(card.getByRole("button", { name: /out of stock/i })).toBeDisabled();
      } else {
        // Not on the first page of the grid — search for it instead, rather
        // than passing on an assertion that never ran.
        await page.goto(`/store/search?q=${encodeURIComponent(target!.name)}`);
        const found = page.locator("article").filter({ hasText: target!.name }).first();
        await expect(found).toBeVisible();
        await expect(found.getByRole("button", { name: /out of stock/i })).toBeDisabled();
      }
    } finally {
      // Restored here rather than left to the teardown: this is the shop's own
      // catalogue, and a failing test must not decide whether a cake is on sale.
      await db
        .collection("products")
        .updateOne({ _id: target!._id }, { $set: { stockStatus: before ?? "in_stock" } });
      const after = await db.collection("products").findOne({ _id: target!._id });
      expect(after!.stockStatus, "the probe did not put the product back").toBe(before ?? "in_stock");
    }
  });
});
