import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * An admin list must not say the shop is empty before it has looked.
 *
 * Every one of these starts from an empty array and fills it in an effect, so
 * the empty branch is reached on EVERY cold load. Products told an admin "No
 * Cakes found — Try another filter, or add your first cake" and offered an Add
 * button, for a catalogue of 25. Coupons offered "Create your first discount
 * code" to a shop running three.
 *
 * Only a browser can tell this apart from the fix: the source contains both
 * branches either way, so a structural test cannot see which one renders. An
 * earlier version of this check was structural and passed with the gate
 * replaced by `false`.
 */

/** Everything the page said, from the first paint onwards. */
async function recordText(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    const observe = () => {
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            const text = (node as HTMLElement).textContent?.trim();
            if (text) w.__said.push(text);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
      // The very first paint too, which the observer above cannot see.
      if (document.body?.textContent) w.__said.push(document.body.textContent);
    };
    if (document.body) observe();
    else document.addEventListener("DOMContentLoaded", observe);
  });
}

const SCREENS: { name: string; path: string; claim: RegExp; ready: RegExp }[] = [
  // Both of these were demonstrated: removing their gate makes this spec fail
  // with "told the admin their shop was empty before it had looked".
  { name: "products", path: "/admin/cakes", claim: /add your first/i, ready: /^cakes$|^products$/i },
  { name: "coupons", path: "/admin/commerce/coupons", claim: /create your first discount code/i, ready: /^all coupons$/i },
  /**
   * Inventory is here as a REGRESSION guard, not as a demonstrated fix.
   *
   * Its gate was added for the same reason as the other two — the table read
   * `paginated.length === 0` with nothing saying whether the first read had
   * happened — but removing that gate again does not make this spec fail, so
   * the empty state does not appear to reach the DOM on this page today. The
   * check is kept because the data flow is identical to the two above and one
   * change to how the page streams would make it visible.
   */
  { name: "inventory", path: "/admin/commerce/inventory", claim: /no inventory records found/i, ready: /^recent history$/i },
];

test.describe("an admin list on a cold load", () => {
  for (const screen of SCREENS) {
    test(`does not claim the shop is empty — ${screen.name}`, async ({ page }) => {
      await adminSession(page);
      await recordText(page);
      await page.goto(screen.path);

      // Wait for the screen itself, so the claim had every chance to appear,
      // then let the fetch settle.
      await expect(page.getByText(screen.ready).first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(1500);

      const said = await page.evaluate(
        () => (window as unknown as { __said: string[] }).__said ?? [],
      );

      expect(
        said.filter((text) => screen.claim.test(text)),
        `${screen.name} told the admin their shop was empty before it had looked`,
      ).toEqual([]);
    });
  }
});
