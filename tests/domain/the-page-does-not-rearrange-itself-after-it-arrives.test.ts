/**
 * THE SHOP WAS NEVER SLOW. IT MOVED.
 *
 * Measured on the production build (`next build` + `next start`), median of
 * three warm runs, phone viewport 390x900:
 *
 *   page        TTFB    LCP     CLS
 *   home        106ms   688ms   0.249
 *   wishlist    102ms   296ms   0.545
 *   cart         96ms   292ms   0.185
 *   shop all    102ms   396ms   0.054
 *
 * Every page answered in about a tenth of a second and painted its biggest
 * element inside 700ms, against a 2.5s budget. And every page then
 * rearranged itself, against a 0.1 budget — the wishlist by five times it.
 * That is what "it does not feel fast" was.
 *
 * TWO CAUSES, both of them a thing arriving after the page had painted.
 *
 * 1. THE PROMO STRIP. A client component that started with no banners,
 *    waited for the browser's copy to settle, and only then drew a 52px bar
 *    above the header — so `main` sat at y=64 in the HTML and jumped to
 *    y=116 about 450ms later, on every page of the shop. It now takes the
 *    live banners from the server, which is what the layout beside it
 *    already did for the store name, the nav, the contact block and the
 *    footer.
 *
 * 2. THE FOOTER SITTING INSIDE THE FOLD. The shell is `min-h-screen` with
 *    `main` as `flex-1`, which normally pins a footer to the bottom of a
 *    short page. It cannot here: this footer is 946px tall on a phone,
 *    taller than the viewport by itself, so the wrapper is never stretched
 *    and `flex-1` never has spare height to take. The footer landed about
 *    770px down a 900px screen while the page was still loading, and then
 *    moved — dragging most of a screen through the viewport. A floor under
 *    `main` keeps it off screen until the page is settled.
 *
 * After both: CLS 0 on every page, at 390 and at 1440.
 *
 * WHAT THIS FILE CAN AND CANNOT DO. It reads source, so it cannot measure
 * CLS — re-measuring means building and driving a browser. What it can do is
 * hold the two structural facts the measurement depended on, because both
 * are the kind that get quietly undone: a prop looks removable, and a
 * utility class looks like decoration.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const SHELL = "layouts/storefront-layout.tsx";
const STRIP = "apps/website/components/storefront-banner-strip.tsx";
const ROUTE_LAYOUTS = ["app/(storefront)/layout.tsx", "app/account/layout.tsx"];

/**
 * The opening `<main ...>` tag, and nothing else in the file.
 *
 * Scoped deliberately. `expect(file).toContain("min-h-svh")` would pass if
 * the class were anywhere at all — on a skeleton, in a comment, in the very
 * docblock that explains it — which is the shape of assertion that passes
 * for the regression it was written against.
 */
function mainTag(source: string): string {
  const match = /<main\b[^>]*>/.exec(source);
  if (!match) throw new Error("no <main> element in the storefront shell");
  return match[0];
}

/** A component's body, from its signature to the end of the file. */
function bodyFrom(source: string, signature: string): string {
  const at = source.indexOf(signature);
  if (at === -1) throw new Error(`could not find ${signature}`);
  return source.slice(at);
}

describe("the promo strip is in the HTML, not added to it", () => {
  const strip = read(STRIP);
  const body = bodyFrom(strip, "export function StorefrontBannerStrip");

  it("takes its banners from the server", () => {
    expect(body, "the component stopped taking a server list").toContain(
      "export function StorefrontBannerStrip({ live }: StorefrontBannerStripProps)",
    );
  });

  it("and draws them on the first render, before any effect has run", () => {
    /*
      THE WHOLE FIX IS THIS LINE. A first render that derives from `live`
      renders the bar into the HTML; one that reads state initialised to a
      list renders nothing until an effect replaces it, which is a 52px
      shift. Both compile, both work, and only one of them is fast.
    */
    expect(body, "the first render no longer derives from the server list").toContain(
      "const banners = fromBrowser ?? forThisRoute(live, pathname);",
    );
  });

  it("and the browser's copy is a later answer, not the starting one", () => {
    /*
      `null` means "the browser has not answered yet"; an empty array is a
      real answer meaning this route shows no banner. Starting from `[]` is
      exactly what made the bar late, so this names that spelling rather
      than merely asking for some useState.
    */
    expect(body, "the browser's list is no longer distinguishable from 'none'").toContain(
      "useState<Banner[] | null>(null)",
    );
    expect(body, "the strip starts from an empty list again — the bar will be late").not.toContain(
      "useState<Banner[]>([])",
    );
  });

  it("and the route filter does not read the clock", () => {
    /*
      `selectActiveHeroBanners` re-checks each banner's schedule against
      `Date.now()`. This filter runs during the server render and again on
      hydration, microseconds apart — a banner starting in that gap would be
      in the HTML and not in the hydration, which is the mismatch the whole
      change exists to remove. `getPublicContent` has already settled the
      schedule.
    */
    const filter = bodyFrom(strip, "function forThisRoute(");
    const upToComponent = filter.slice(0, filter.indexOf("interface StorefrontBannerStripProps"));
    expect(upToComponent, "the route filter went back to the scheduling one").not.toContain(
      "selectActiveHeroBanners",
    );
    expect(upToComponent, "the route filter started reading the clock").not.toContain("Date.now");
  });
});

describe("the shell hands the strip a list it read on the server", () => {
  it("passes it down instead of letting the strip fetch", () => {
    const shell = read(SHELL);
    expect(shell, "the shell stopped handing the strip its banners").toContain(
      "<StorefrontBannerStrip live={bannerStrip} />",
    );
  });

  for (const file of ROUTE_LAYOUTS) {
    it(`${file} reads them beside the rest of the chrome`, () => {
      /*
        BOTH LAYOUTS, not one. The account pages render the same shell, and
        a prop added in one place and forgotten in the other is a type
        error here only because the prop is required — which is why it is
        required rather than optional.
      */
      const source = read(file);
      expect(source, "the server read is gone, so the strip is back to fetching").toContain(
        'getPublicContent("banners")',
      );
      expect(source, "the list is read but never handed over").toContain(
        "bannerStrip={bannerStrip}",
      );
    });
  }
});

describe("the footer waits below the fold while the page arrives", () => {
  const tag = mainTag(read(SHELL));

  it("because main has a floor of its own", () => {
    /*
      NOT `flex-1` ALONE, which is what was there. The wrapper is
      `min-h-screen` and this is its only growing child, so on most sites
      that pins the footer to the bottom of a short page. Not with a 946px
      footer: the wrapper is already past the viewport without any help, so
      there is no spare height to distribute and `flex-1` resolves to the
      content's own height.
    */
    expect(tag, "main lost its height floor — the footer is back inside the fold").toMatch(
      /\bmin-h-svh\b/,
    );
  });

  it("measured in small viewport units, which do not move", () => {
    /*
      `dvh` grows and shrinks as a phone's address bar hides, which resizes
      the exact box this exists to hold still — it would trade a load-time
      shift for a scroll-time one. Spelled out as a negative because the two
      class names differ by one letter.
    */
    expect(tag, "main is floored in dynamic units, which change as the page is scrolled").not.toMatch(
      /\bmin-h-dvh\b/,
    );
    expect(tag, "main is floored in large viewport units, which overshoot on a phone").not.toMatch(
      /\bmin-h-lvh\b/,
    );
  });

  it("and the floor is lifted for print, so an invoice has no blank page", () => {
    /*
      `/store/order/[orderNumber]/invoice` renders inside this shell, and a
      screen-height main pushes its footer onto a second sheet. Same
      treatment as `layouts/admin-layout.tsx`, which carries `print:min-h-0`
      for the same reason.
    */
    expect(tag, "the print override is gone — the invoice gains a blank page").toContain(
      "print:min-h-0",
    );
  });
});
