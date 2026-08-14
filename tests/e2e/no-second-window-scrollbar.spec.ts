import { expect, test, type Page } from "@playwright/test";

import { adminSession } from "./admin-session";

/**
 * The admin shell owns exactly one scrollbar, and it is not the window's.
 *
 * The shell is `h-dvh overflow-hidden` with a single `overflow-y-auto` main, so
 * the document should never exceed the viewport. On the dashboard and the
 * reports page it did — by 545px and 732px — for as long as their figures were
 * loading, painting a second scrollbar down the right edge on every reload.
 *
 * The cause was one class. Tailwind's `sr-only` is `position: absolute`, and
 * the loading skeletons' `role="status"` wrapper was not positioned — so the
 * span's containing block was the INITIAL one. It escaped every `overflow:
 * hidden` between itself and <body> and laid out at its static position inside
 * the scrolled content; on a panel far enough down the page, that position is
 * past the viewport, and `documentElement.scrollHeight` grew to reach it.
 *
 * Only these two pages, because only they have enough above their skeletons to
 * push one past the fold. The measurement has to happen WHILE they load: the
 * layout effect that sets `html { overflow: hidden }` runs after hydration and
 * hides the evidence.
 *
 * Structural tests cannot see this. It is a containing-block resolution, which
 * only a browser performs.
 */

const PAGES = [
  { name: "dashboard", path: "/admin/dashboard" },
  { name: "reports", path: "/admin/reports" },
  // Their siblings, so the guard covers the shell rather than two pages.
  { name: "orders", path: "/admin/orders" },
  { name: "customers", path: "/admin/customers" },
  { name: "inquiries", path: "/admin/inquiries" },
];

/** The document's height against the viewport's, sampled while the page loads. */
async function samplesDuringLoad(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sizes: { at: number; scrollH: number; clientH: number }[] };
    w.__sizes = [];
    for (const at of [300, 800, 1500, 2500]) {
      setTimeout(() => {
        const html = document.documentElement;
        w.__sizes.push({ at, scrollH: html.scrollHeight, clientH: html.clientHeight });
      }, at);
    }
  });

  await page.goto(path);
  await page.waitForTimeout(2800);

  return page.evaluate(
    () => (window as unknown as { __sizes: { at: number; scrollH: number; clientH: number }[] }).__sizes,
  );
}

for (const target of PAGES) {
  test(`${target.name} does not grow a second scrollbar while it loads`, async ({ page }) => {
    await adminSession(page);

    const sizes = await samplesDuringLoad(page, target.path);
    expect(sizes.length, "no measurements were taken").toBeGreaterThan(0);

    for (const { at, scrollH, clientH } of sizes) {
      expect(
        scrollH,
        `${target.name} at t+${at}ms: the document is ${scrollH - clientH}px taller than the ` +
          `viewport, so the window paints a scrollbar beside the shell's own`,
      ).toBeLessThanOrEqual(clientH);
    }
  });
}
