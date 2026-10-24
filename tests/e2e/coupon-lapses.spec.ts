import { expect, test, type Page } from "@playwright/test";

import { connect } from "./shop-state";
import { probeEmail, removeCustomer, signInAsCustomer } from "./sign-in";

/**
 * A coupon applied to one cart, and then the cart changes.
 *
 * The customer goes back to fix their order — that is what the Back button is
 * for — and a coupon with a minimum order value stops qualifying. The discount
 * left the totals immediately. The green "WED2026 (₹2000 OFF)" chip beside them
 * did not, so the page showed a coupon as applied and a total with no discount
 * in it, and said nothing about either.
 *
 * Driven through the real screens, because the fault was never in the coupon
 * rules — `revalidateCoupon` returned null exactly as it should. It was in what
 * the page did with that null.
 */



async function addToCart(page: Page, slug: string) {
  await page.goto(`/store/p/${slug}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
}

test.describe("a coupon that stops qualifying", () => {
  let customerEmail = "";

  test.afterAll(async () => {
    await removeCustomer(customerEmail);
  });

  test("says so, instead of staying green over a total with no discount", async ({ page }) => {
    // The shop's own coupon and its own minimum, read rather than assumed.
    const db = await connect();
    // The coupon with the LOWEST minimum, so the cart that clears it is small —
    // among the ones a customer can actually use TODAY. `isActive` alone picked
    // RAKHI20, switched on but expired since August, which the shop refused
    // exactly as it should, and the test read that as the flow failing.
    const now = Date.now();
    const live = (await db
      .collection("coupons")
      .find({ isActive: true, minSubtotal: { $gt: 0 } })
      .sort({ minSubtotal: 1 })
      .toArray()).filter(
      (c) =>
        (!c.expiresAt || new Date(c.expiresAt).getTime() > now) &&
        (!c.startsAt || new Date(c.startsAt).getTime() <= now),
    );
    const coupon = live[0] ?? null;
    expect(coupon, "this shop has no coupon with a minimum order value to test").toBeTruthy();

    /*
      THE DEAREST CAKE, AS MANY AS IT TAKES. This asked for one product priced
      at the coupon's minimum on its own, and this shop's cheapest minimum
      (₹10,000) is three times its dearest cake (₹3,399) — so the test stopped
      at its own precondition and the flow it guards was never driven. Several
      of one cake clear the minimum the way a customer's party order does.
    */
    const dear = await db
      .collection("products")
      .find({ status: "published", stockStatus: { $ne: "out_of_stock" } })
      .sort({ price: -1 })
      .next();
    const cheap = await db
      .collection("products")
      .findOne({ status: "published", price: { $lt: 2000 }, slug: { $ne: dear?.slug } });
    expect(dear, "the shop has no product to buy").toBeTruthy();
    expect(cheap, "no inexpensive product to leave in the cart").toBeTruthy();
    const copies = Math.ceil(coupon!.minSubtotal / dear!.price);
    test.skip(copies > 10, `the coupon's minimum needs ${copies} of the dearest cake`);

    // A real session: checkout asks the server now, so a planted key bounces.
    customerEmail = await probeEmail("coupon");
    await signInAsCustomer(page, customerEmail);
    await addToCart(page, dear!.slug);
    await addToCart(page, cheap!.slug);

    // ---- apply it while the cart qualifies ----
    // On the cart, where the coupon box lives now: one "Apply Coupons" row that
    // opens a dialog. Checkout keeps only the notice for a coupon that lapsed.
    await page.goto("/store/cart");

    // Enough of the dear cake to clear the minimum, raised on its own row.
    const dearLine = page
      .locator("div.rounded-xl")
      .filter({ has: page.locator(`a[href="/store/p/${dear!.slug}"]`) });
    await expect(dearLine, "the dear cake's cart row could not be found").toHaveCount(1);
    for (let n = 1; n < copies; n += 1) {
      await dearLine.getByRole("button", { name: /increase quantity/i }).click();
      await expect(dearLine.getByText(String(n + 1), { exact: true }).first()).toBeVisible();
    }
    await page.getByRole("button", { name: /apply coupons/i }).click();
    const coupons = page.getByRole("dialog");
    await coupons.getByPlaceholder(/coupon code/i).fill(coupon!.code);
    // The box's own Apply; each listed offer below it carries one too.
    await coupons.getByRole("button", { name: /^apply$/i }).first().click();
    await expect(page.getByText(coupon!.code, { exact: false }).first()).toBeVisible();
    await expect(
      page.getByText(/no longer applies/i),
      "the coupon was refused on a cart that qualifies",
    ).toHaveCount(0);

    // ---- go back and take the expensive cake out ----
    await page.goto("/store/cart");

    // The row for THIS cake, identified by its own product link rather than by
    // its text. An earlier version filtered containers by name, matched a
    // wrapper holding both rows, and removed the other cake — leaving a cart
    // that still qualified and a test that failed for the wrong reason.
    const dearRow = page
      .locator("div.rounded-xl")
      .filter({ has: page.locator(`a[href="/store/p/${dear!.slug}"]`) });
    await expect(dearRow, "the cart row could not be identified unambiguously").toHaveCount(1);
    await dearRow.getByRole("button", { name: /remove item/i }).click();

    // Gone, before anything downstream is asserted.
    await expect(dearRow).toHaveCount(0);

    await page.getByRole("button", { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/store\/checkout/);

    // ---- the page has to admit it ----
    await expect(
      page.getByText(/no longer applies/i),
      "the coupon still reads as applied over a total that no longer includes it",
    ).toBeVisible();
  });
});
