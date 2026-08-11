import { expect, test, type Page } from "@playwright/test";

import { connect } from "./shop-state";

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

const CUSTOMER_KEY = "bakery-cms-customer-session";

async function signIn(page: Page) {
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          email: "coupon-probe@example.com",
          name: "Coupon Probe",
          phone: "9000000001",
          signedInAt: new Date().toISOString(),
        }),
      ),
    CUSTOMER_KEY,
  );
}

async function addToCart(page: Page, slug: string) {
  await page.goto(`/store/cakes/${slug}`);
  await page.getByRole("button", { name: /add to cart/i }).first().click();
}

test.describe("a coupon that stops qualifying", () => {
  test("says so, instead of staying green over a total with no discount", async ({ page }) => {
    // The shop's own coupon and its own minimum, read rather than assumed.
    const db = await connect();
    const coupon = await db.collection("coupons").findOne({ isActive: true, minSubtotal: { $gt: 0 } });
    expect(coupon, "this shop has no coupon with a minimum order value to test").toBeTruthy();

    const dear = await db
      .collection("products")
      .findOne({ status: "published", price: { $gte: coupon!.minSubtotal } });
    const cheap = await db
      .collection("products")
      .findOne({ status: "published", price: { $lt: 2000 } });
    expect(dear, "no single product reaches the coupon's minimum").toBeTruthy();
    expect(cheap, "no inexpensive product to leave in the cart").toBeTruthy();

    await signIn(page);
    await addToCart(page, dear!.slug);
    await addToCart(page, cheap!.slug);

    // ---- apply it while the cart qualifies ----
    await page.goto("/store/cart");
    await page.getByRole("button", { name: /proceed to checkout/i }).click();
    await expect(page).toHaveURL(/\/store\/checkout/);

    await page.getByPlaceholder(/coupon code/i).fill(coupon!.code);
    await page.getByRole("button", { name: /^apply$/i }).click();
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
      .filter({ has: page.locator(`a[href="/store/cakes/${dear!.slug}"]`) });
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
