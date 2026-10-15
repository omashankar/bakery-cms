import { expect, type Page } from "@playwright/test";

/**
 * Book a delivery the way a customer does now: open "Delivery date & time",
 * pick a day a few days out (today's windows may all have closed), pick a
 * delivery type when the shop sells more than one, then a window.
 *
 * Fails loudly when the dialog offers no window, rather than walking on to a
 * Continue that will refuse — the old `if (firstReal)` let exactly that pass.
 */
export async function bookDeliverySlot(page: Page, daysAhead = 5): Promise<void> {
  await page.locator("#deliveryDate").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog, "the delivery dialog did not open").toBeVisible();

  const day = new Date();
  day.setDate(day.getDate() + daysAhead);
  const iso = [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, "0"),
    String(day.getDate()).padStart(2, "0"),
  ].join("-");
  await dialog.getByLabel("Delivery date").fill(iso);

  // A shop with delivery types asks for one; take the first.
  if (await dialog.getByText("Choose delivery type").isVisible().catch(() => false)) {
    await dialog.getByRole("listitem").getByRole("button").first().click();
  }

  if (await dialog.isVisible().catch(() => false)) {
    const windows = dialog.getByRole("list", { name: "Delivery time" }).getByRole("button");
    await expect(windows.first(), "the shop offered no delivery window to choose").toBeVisible();
    await windows.first().click();
  }
  await expect(dialog).toBeHidden();
}
