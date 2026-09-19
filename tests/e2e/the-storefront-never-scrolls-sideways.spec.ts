import { expect, test } from "@playwright/test";

/**
 * NO STOREFRONT PAGE SCROLLS SIDEWAYS, AT ANY WIDTH A CUSTOMER HAS.
 *
 * A page that slides left and right is not a small fault: every tap becomes a
 * near-miss, the header drifts off one edge, and on a phone it reads as a site
 * that is broken rather than one that is narrow.
 *
 * It keeps happening because it is invisible in a diff and nearly invisible on
 * screen — the last two were 2px and 31px, and both survived because nothing
 * looked at the widths where they lived:
 *
 *   - the header ran 2px over at 640 and 641 and NOWHERE ELSE. That is where
 *     `sm:` turns on, and three things arrived at once: the delivery pill, the
 *     Login button and a wider gap. The search box between them was being
 *     squeezed to zero at the same time, so the band the header documents as
 *     "every tablet and every phone held sideways" had a search box 0 pixels
 *     wide.
 *   - the contact form ran 31px over at 320 and nowhere above it. A grid
 *     item's default min-width is `auto`, so the column would not shrink below
 *     the intrinsic width of the inputs inside it.
 *
 * Neither is reachable by reading source: one is a breakpoint boundary and the
 * other is intrinsic sizing. So the widths are swept, including the ones either
 * side of every breakpoint this codebase uses.
 */

const PAGES = [
  { name: "homepage", path: "/store" },
  { name: "collections", path: "/store/collections" },
  { name: "cart", path: "/store/cart" },
  { name: "search", path: "/store/collections?q=cake" },
  { name: "contact", path: "/store/contact" },
];

/**
 * THE EDGES OF EVERY BREAKPOINT, not a tidy handful of devices.
 *
 * Both faults lived on a boundary or below the smallest phone anybody tests.
 * 639/640/641 is the `sm` edge, 767/768 is `md`, 1023/1024 is `lg`, and 320 is
 * the narrowest screen still in use.
 */
const WIDTHS = [
  320, 360, 390, 480, 600, 639, 640, 641, 700, 767, 768, 900, 1023, 1024, 1280, 1440,
];

for (const target of PAGES) {
  test(`the ${target.name} never scrolls sideways`, async ({ page }) => {
    test.setTimeout(120_000);
    const broken: string[] = [];

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      /*
        THE STATUS IS CHECKED, and it was not.

        This swept a list of paths and measured whatever came back. Delete a
        route from that list and Next serves the ROOT 404 — header-less, a
        few hundred pixels tall, and of course it does not scroll sideways.
        Sixteen widths of green for a page that no longer exists, which is
        exactly what happened when the search page was retired.
      */
      const answer = await page.goto(target.path);
      expect(
        answer?.status(),
        `${target.name} answered ${answer?.status()} at ${target.path}`,
      ).toBeLessThan(400);
      await page.waitForTimeout(500);

      const seen = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        const over = document.documentElement.scrollWidth - limit;
        if (over <= 0) return { over, limit, blame: [] as string[] };

        /*
          NAME WHAT DID IT. A bare "the page is 2px too wide" sends the next
          person hunting through a whole document; the element and its classes
          are what actually shortens the search.
        */
        const blame: string[] = [];
        for (const el of document.querySelectorAll("body *")) {
          const box = el.getBoundingClientRect();
          if (box.right <= limit + 0.5 && box.left >= -0.5) continue;
          // Only the deepest offenders: every ancestor of an over-wide box is
          // over-wide too, and listing them all is noise.
          if ([...el.children].some((kid) => kid.getBoundingClientRect().right > limit + 0.5)) {
            continue;
          }
          blame.push(
            `${el.tagName.toLowerCase()} ${Math.round(box.width)}px ` +
              `(${Math.round(box.left)}..${Math.round(box.right)}) ` +
              `${(el.className || "").toString().slice(0, 50)}`,
          );
        }
        return { over, limit, blame: blame.slice(0, 3) };
      });

      // The viewport really applied. Without this the whole sweep could be
      // sixteen runs of the same experiment.
      expect(seen.limit, `the viewport did not apply at ${width}px`).toBeLessThanOrEqual(width);

      if (seen.over > 0) {
        broken.push(`${width}px: +${seen.over} — ${seen.blame.join(" | ") || "no single element"}`);
      }
    }

    expect(
      broken,
      `${target.name} scrolls sideways at ${broken.length} of ${WIDTHS.length} widths:\n  ` +
        broken.join("\n  "),
    ).toEqual([]);
  });
}

test("and the header's search box is a box, not a sliver", async ({ page }) => {
  /*
    THE OTHER HALF OF THE HEADER FAULT, and the reason it is worth its own
    case: fixing the 2px would have been enough to make the sweep above pass
    while leaving an 83px search box on every tablet. A control too small to
    type into is a bug that no overflow check can see.

    The header shows a box from `sm` and a search ICON below it, so above 640
    there must be a box and it must be usable. 140px is not a target — it is
    the floor below which the placeholder and the submit button collide.
  */
  for (const width of [640, 700, 768, 900, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/store");
    await expect(page.locator("header").first()).toBeVisible();

    const box = await page.evaluate(() => {
      const input = document.querySelector('header input[type="search"]');
      if (!(input instanceof HTMLElement)) return null;
      const rect = input.getBoundingClientRect();
      return { width: Math.round(rect.width), shown: rect.width > 0 && rect.height > 0 };
    });

    // A shop can switch search off entirely; that is not this test's business.
    if (box === null) {
      test.skip(true, "this shop has no header search");
      return;
    }

    expect(box.shown, `the header search box is not drawn at ${width}px`).toBe(true);
    expect(
      box.width,
      `the header search box is ${box.width}px wide at ${width}px`,
    ).toBeGreaterThan(140);
  }
});

test("and a phone can ask whether the shop delivers to it", async ({ page }) => {
  /*
    THE CONTROL THAT MOVED. The delivery pill is 183px, which is most of a
    tablet's header row, so it now waits for `lg` — and the note beside it had
    claimed for a long time that the same check was "a tap away in the drawer"
    while nothing rendered it there. Below 1024 a customer had no way to ask at
    all short of opening a product page.

    It opens DOWNWARDS, which is why it sits at the top of the drawer: in the
    middle, at 390x900, its panel landed at 937..969 — past the fold and past
    the drawer's own scroll box, so the tap appeared to do nothing.
  */
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/store");
    await page.click('[aria-label="Open menu"]');

    /*
      A MISSING CONTROL IS NOT THE SAME AS A SHOP WITH NO ZONES, and the
      first draft of this case could not tell them apart: it skipped when
      the drawer had no delivery button, so deleting the control outright
      turned this green. Measured — the mutation that removes it reported
      `1 skipped`.

      The header's own pill is the tell. It is mounted on the same
      `hasDeliveryZones` flag, and at 1280 it is above the cut, so if it is
      there the shop has zones and the drawer owes the customer the same
      control.
    */
    const trigger = page.locator("#storefront-mobile-nav button", {
      hasText: /deliver/i,
    });
    if ((await trigger.count()) === 0) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/store");
      const pill = await page.locator("header button", { hasText: /deliver/i }).count();
      expect(
        pill,
        "the header offers a delivery check and the drawer does not — a phone cannot ask at all",
      ).toBe(0);
      test.skip(true, "this shop has no delivery zones");
      return;
    }

    await trigger.first().click();

    const panel = page.locator("#storefront-mobile-nav input").first();
    await expect(
      panel,
      `the delivery panel does not open in view at ${width}px`,
    ).toBeInViewport();
  }
});
