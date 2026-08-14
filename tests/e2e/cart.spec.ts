import { expect, test, type Page } from "@playwright/test";

/**
 * The cart, driven by clicks.
 *
 * Nothing here touches the database — the cart lives in the browser — so this
 * spec needs no cleanup beyond the shared teardown. What it checks is the part
 * no unit test can: that the controls on the page do what they say.
 */

async function addFirstProduct(page: Page) {
  await page.goto("/store");
  const firstProduct = page.locator('a[href^="/store/cakes/"]').first();
  await expect(firstProduct).toBeVisible();
  const href = await firstProduct.getAttribute("href");
  await page.goto(href!);

  await page.getByRole("button", { name: /add to cart/i }).first().click();
  await page.goto("/store/cart");
  await expect(page.getByRole("button", { name: /remove item/i }).first()).toBeVisible();
}

test.describe("the cart", () => {
  test("holds what was added, and shows a total for it", async ({ page }) => {
    await addFirstProduct(page);

    // A cart with a line in it must price that line. "₹0" with an item on
    // screen is the shape of a total computed before the item was read.
    const summary = page.getByRole("heading", { name: /order summary/i });
    await expect(summary).toBeVisible();
    await expect(page.getByText(/₹\s*[1-9]/).first()).toBeVisible();
  });

  test("can be emptied, and stays empty across a reload", async ({ page }) => {
    await addFirstProduct(page);

    await page.getByRole("button", { name: /remove item/i }).first().click();

    // An emptied cart that refills itself is the seed-resurrection shape this
    // codebase has produced in five other stores.
    await expect(page.getByRole("button", { name: /remove item/i })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("button", { name: /remove item/i })).toHaveCount(0);
  });

  test("changes the quantity, and the total moves with it", async ({ page }) => {
    await addFirstProduct(page);

    const totalBefore = await page.locator("text=/₹/").last().textContent();
    await page.getByRole("button", { name: /increase quantity/i }).first().click();

    // The number beside the cake and the number at the bottom have to agree —
    // a quantity that changes one but not the other is a customer being shown
    // a price they will not be charged.
    await expect
      .poll(async () => page.locator("text=/₹/").last().textContent(), { timeout: 10_000 })
      .not.toBe(totalBefore);
  });

  test("does not let the quantity go below one from the cart", async ({ page }) => {
    await addFirstProduct(page);

    // Disabled rather than allowed-then-corrected: a zero-quantity line is a
    // cart the customer cannot reason about.
    await expect(page.getByRole("button", { name: /decrease quantity/i }).first()).toBeDisabled();
  });

  test("survives a reload with its contents intact", async ({ page }) => {
    await addFirstProduct(page);
    const before = await page.getByRole("button", { name: /remove item/i }).count();

    await page.reload();

    await expect(page.getByRole("button", { name: /remove item/i })).toHaveCount(before);
  });
});
