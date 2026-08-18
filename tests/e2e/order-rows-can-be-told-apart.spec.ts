import { expect, test } from "@playwright/test";

import { adminSession } from "./admin-session";
import { connect } from "./shop-state";

/**
 * The rows of an order, in a real browser, on a real order.
 *
 * `QuoteLineInput` carries no `id` — the storefront sends what it CHOSE, not
 * what the shop calls it — so the priced line the server built had none either,
 * and every order placed through checkout was stored with items that could not
 * be told apart. Three screens key their rows on `item.id`, and React said so.
 *
 * A unit test can prove the repair function is correct. Only a browser can
 * prove the repair actually REACHES the screen: the order arrives through
 * `toOrder` on the server, or through the browser's own cache, and the page
 * renders whichever answered first. That is the part that was broken, and it is
 * not visible from the source.
 *
 * Driven against an order that is genuinely in the bad state rather than a
 * fixture, and skipped if the shop has none — inventing one would mean writing
 * an order with deliberately corrupt items into the shared database.
 */
test.describe("an order whose stored items have no ids", () => {
  test("renders without duplicate React keys", async ({ page }) => {
    const db = await connect();
    const orders = await db.collection("orders").find({}).toArray();
    const bare = orders.find((order) =>
      ((order.items as { id?: string }[] | undefined) ?? []).some((item) => !item?.id),
    );

    test.skip(!bare, "no order in this shop still has items without ids");

    await adminSession(page);

    /**
     * Every console message, not only errors.
     *
     * React reports a missing or duplicated key as a WARNING through
     * `console.error` in development — but the wording is what identifies it,
     * not the level, and levels have moved between React versions.
     */
    const complaints: string[] = [];
    page.on("console", (message) => {
      const text = message.text();
      if (/unique "?key"? prop|Encountered two children with the same key/i.test(text)) {
        complaints.push(text);
      }
    });

    await page.goto(`/admin/orders/${String(bare!._id)}`);

    // The items list is what this is about — wait for a row rather than for the
    // page, or the assertion runs before the thing it checks has rendered.
    await expect(page.getByRole("heading", { name: "Items" })).toBeVisible();

    expect(complaints, `React could not tell the rows apart:\n  ${complaints.join("\n  ")}`).toEqual(
      [],
    );

    /**
     * And the rows really rendered, rather than the warning merely being quiet
     * because the list came out empty.
     *
     * An order with no rows cannot produce a duplicate key, and would pass the
     * check above for the wrong reason.
     *
     * Matched on the item's NAME, not on an `<img>`: these are exactly the
     * lines with no image, so what renders is `SafeImage`'s placeholder. An
     * earlier version of this test looked for the image and failed on a page
     * that was working perfectly.
     */
    const items = (bare!.items ?? []) as { name?: string }[];
    expect(items.length, "the chosen order has no items, so this proved nothing").toBeGreaterThan(0);

    for (const item of items) {
      if (!item.name) continue;
      // `:visible`, because the page also carries a `hidden print:block` copy of
      // the whole invoice — and that copy comes FIRST in the DOM, so an
      // unqualified `.first()` resolves to a node that is never on screen and
      // reports the working page as broken.
      await expect(page.locator("li:visible", { hasText: item.name }).first()).toBeVisible();
    }

    /**
     * And the cake is SHOWN, not a grey box.
     *
     * `SafeImage`'s placeholder is the right rendering for an item with no
     * picture — and every one of these items had none, because the priced line
     * read `product.image` through a cast to a shape the repository does not
     * return. Fixing the crash made the page load with a placeholder in every
     * row, which looks deliberate and is not.
     */
    await expect(page.locator("main img, main [role=img]").first()).toBeVisible();

    /**
     * The crash this page was ACTUALLY dying of, kept in the same test.
     *
     * `SafeImage` took `src: string` while an order line carries no image at
     * all, so `src.trim()` threw and React unwound to the boundary: the whole
     * order rendered as "This page couldn't load". The key warning was the
     * quieter of the two problems on this screen, and a test that only watched
     * the console would have called it fixed while the page was blank.
     */
    await expect(page.getByRole("heading", { name: /couldn.t load/i })).toHaveCount(0);
  });
});
