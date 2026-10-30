import { expect, type Page } from "@playwright/test";

/**
 * Pin the door on the checkout map, the way a customer does: tap the map.
 *
 * The map pin decides delivery since e87037dc, and an address step with no pin
 * cannot be continued — every journey through checkout that only typed a PIN
 * stopped there. It taps the middle of the first zone the map shades, so the
 * pin lands where the shop delivers whatever the shop has drawn, and waits for
 * the server to say so.
 *
 * Fails loudly when the shop has no drawn zone on the map, rather than tapping
 * somewhere at random and walking on to a Continue that will refuse.
 */
export async function pinDeliveryDoor(page: Page): Promise<void> {
  const map = page.getByLabel("Map: tap or drag the pin onto your door");
  await map.scrollIntoViewIfNeeded();
  await expect(map, "the checkout has no delivery map").toBeVisible();

  const shape = map.locator(".leaflet-overlay-pane path").first();
  await expect(shape, "the map shades no delivery zone to pin inside").toBeVisible();
  const box = await shape.boundingBox();
  expect(box, "the zone on the map has no size").not.toBeNull();

  // The shape is drawn non-interactive, so the tap reaches the map beneath it.
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(
    page.getByRole("status").filter({ hasText: "Delivery available" }),
    "the pin in the middle of the zone was not accepted",
  ).toBeVisible({ timeout: 30_000 });
}
