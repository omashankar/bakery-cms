/**
 * THE HEADER THE SHOP ASKED FOR, IN THE PLACES IT ASKED FOR THEM.
 *
 * The reference header is three rows: a thin utility row (Help, Currency, Track
 * Order), the main bar (logo, a wide search box, a deliver-to control, the icon
 * cluster), and a full-width strip of categories with EXPRESS highlighted and a
 * promoted item behind a divider.
 *
 * What existed was ONE 64px bar with the nav inline beside the logo — which
 * fits four rows, not eleven plus a promoted item. So the per-row emphasis was
 * worth nothing until the layout could hold the rows, and the search was an
 * ICON a navigation away from the control the reference puts in front of every
 * visitor.
 *
 * Every case here is about the rule rather than the pixels: the row must exist,
 * it must be the shop's own content, and a shop that has written nothing must
 * be exactly where it was.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { headerSchema } from "@/features/site-layout/server/site-layout.validators";
import { defaultHeaderSettings } from "@/features/site-layout/lib/header-utils";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const NAVBAR = "apps/website/components/storefront-navbar.tsx";

describe("the row above the main bar, and the button beside the cart", () => {
  /*
    BOTH ARE GONE, at the shop's request, and both were LIVE when they went.

    The thin row read "Currency · INR" on every page, and the header carried
    an "Order Inquiry" button beside the cart. The shop crossed them out on
    the Header screen and confirmed they should leave the site too.

    Five cases used to pin that they worked. These pin that they are gone,
    in every place they lived, so restoring any one part on its own turns
    this red — a removal with no guard is how a removed thing comes back,
    and these have form: a script once switched them off and they were on
    again afterwards.
  */
  it("is gone from the stored shape, the defaults and the schema", () => {
    const types = code("types/site-layout.ts");
    expect(types, "the top row is offered again").not.toMatch(/^\s*utilityNav/m);
    expect(types).not.toMatch(/^\s*showCurrencyNote/m);
    expect(types, "the CTA is offered again").not.toMatch(/^\s*showCta/m);

    expect("utilityNav" in defaultHeaderSettings, "a new shop gets a top row").toBe(false);
    expect("showCta" in defaultHeaderSettings, "a new shop gets a CTA").toBe(false);

    /*
      AND THE SCHEMA DROPS THEM ON THE WAY IN. This endpoint takes a whole
      document replace over a `.passthrough()` object, and the admin's form
      is the defaults spread over a browser cache that still holds all five —
      so without the transform the next save of the logo letter would write
      them straight back over a cleaned database.
    */
    const parsed = headerSchema.parse({
      logoLetter: "S",
      nav: [],
      utilityNav: [
        { id: "u1", label: "Track Order", href: "/t", isVisible: true, sortOrder: 1 },
      ],
      showCurrencyNote: true,
      showCta: true,
      ctaLabel: "Order Inquiry",
      ctaHref: "/store/contact",
    }) as Record<string, unknown>;

    for (const key of [
      "utilityNav",
      "showCurrencyNote",
      "showCta",
      "ctaLabel",
      "ctaHref",
    ]) {
      expect(key in parsed, `${key} survived the save`).toBe(false);
    }
    expect(parsed.logoLetter, "the transform took something it should not").toBe("S");
  });

  it("is gone from both screens, and the promo strip above it is NOT", () => {
    const navbar = code(NAVBAR);
    expect(navbar, "the top row is drawn again").not.toContain("currencyNote");
    expect(navbar).not.toContain("utilityNav");
    expect(navbar, "the CTA is drawn again").not.toContain("chrome.cta");

    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome).not.toContain("showCurrencyNote");
    expect(chrome).not.toContain("header.utilityNav");

    /*
      THE ONE THING THAT MUST NOT HAVE GONE WITH THEM.

      The promo strip was crossed out too, and it STAYED — probed: the
      published homepage has no Promo Banner section and the Banner Grid
      section draws its own separate list, so the strip is the only place
      this shop's two live offers reach a customer. Removing it would have
      taken them off the site altogether.
    */
    expect(chrome, "the promo strip went too").toContain("showBannerStrip");
    const admin = code("apps/admin/header/components/header-admin-page.tsx");
    expect(admin, "the shop can no longer switch the strip").toContain(
      "settings.showBannerStrip",
    );
  });
});

describe("the search box", () => {
  it("is a real box in the header, not a link to another page", () => {
    const navbar = code(NAVBAR);

    expect(navbar).toMatch(/<form[\s\S]{0,200}action=\{routes\.store\.collections\}/);
    expect(navbar).toContain('name="q"');
  });

  it("submits by GET to the page that already reads it", () => {
    /**
     * A plain form, so it works before hydration and with JavaScript off.
     *
     * IT USED TO POST TO A SEARCH PAGE OF ITS OWN, and the shop asked for
     * that page to go: it drew a second search box, five hardcoded bakery
     * words under "Popular:", and a grid the collections page already draws.
     * The results land on the collections page now, which is where a
     * customer can narrow them further.
     *
     * The far end has to READ `q`, and that is the half that fails silently:
     * a form pointed at a page that ignores the parameter looks perfectly
     * well and searches nothing.
     */
    const route = code("app/(storefront)/store/collections/page.tsx");

    expect(route, "the collections route does not take a query").toContain(
      "q?: string",
    );
    expect(route, "the query never reaches the page").toContain("initialSearch={q");
  });

  it("and the page it lands on re-reads the query on every search", () => {
    /**
     * THE TRAP THE OLD PAGE HAD ALREADY SOLVED. The collections page seeds
     * its filters from a lazy initialiser, which runs ONCE. Searching a
     * second time is a same-route navigation — ?q=a to ?q=b — so nothing
     * remounts and the second search would show the first search's results.
     *
     * It passes a first manual test and fails the second.
     */
    const page = code("apps/website/pages/collections-page.tsx");

    expect(page, "the query is never re-seeded").toContain("}, [initialSearch]);");
  });

  it("says the shop's own line when it has one, and a generic one otherwise", () => {
    /**
     * "Search 5000+ flowers, cakes, gifts etc" is a claim about a catalogue.
     * Only the shop knows whether it has 5,000 of anything, so the default is
     * the shop's own plural and the sentence is a field.
     */
    const navbar = code(NAVBAR);

    expect(navbar).toContain("searchPlaceholder ||");
    expect(navbar).toContain("labels.productWordPlural.toLowerCase()");
  });

  it("and the shop has somewhere to type that line", () => {
    /**
     * The field was typed, validated, carried through the chrome and rendered
     * by the navbar — with no input anywhere in the admin. A shop could not
     * set it by any means short of editing the document, so the fallback was
     * the only line any shop ever saw.
     */
    const admin = code("apps/admin/header/components/header-admin-page.tsx");

    expect(admin, "there is no box for the search placeholder").toContain(
      "searchPlaceholder: e.target.value",
    );
    /*
      And the box is NOT prefilled with an example. A placeholder here would
      be this software suggesting a sentence about the size of a catalogue it
      knows nothing about, which is the claim the field exists to avoid.
    */
    const box = admin.slice(admin.indexOf('id="search-placeholder"'));
    expect(box.slice(0, 500)).toContain('placeholder="Optional"');
  });

  it("and the switch beside it describes what it switches", () => {
    // It read "Search icon on desktop navbar" for a control that is a search
    // BOX, from tablet width up, with an icon on phones.
    const admin = code("apps/admin/header/components/header-admin-page.tsx");
    expect(admin).not.toContain("Search icon on desktop navbar");
  });

  it("is a box from the first width that can hold one", () => {
    /**
     * It started at lg. Between 640 and 1023px — every tablet, and every
     * phone held sideways — there was an icon linking to a separate page,
     * which is the arrangement this whole file exists to replace.
     */
    const navbar = code(NAVBAR);
    const form = navbar.slice(navbar.indexOf("<form"), navbar.indexOf("</form>"));

    expect(form, "the box starts at lg again").toContain("sm:flex");
    expect(form).not.toContain("lg:flex");
  });

  it("and the icon is phones-only, which is what the file always claimed", () => {
    /**
     * The class was `hidden … sm:flex lg:hidden`, which HID the icon below
     * 640px and showed it on tablets — so a phone had no search control in
     * the header at all, under a comment saying "phones only". The comment
     * was the accurate half of the intent; the classes were the bug.
     *
     * FOUND BY THE PHONE ICON'S HANDLER, not by the link it used to be. This
     * guard read `href={routes.store.collections} aria-label="Search"` — so
     * it pinned in place the exact thing the shop then asked to have removed,
     * and the only way to satisfy the shop was to fail this test.
     */
    const navbar = code(NAVBAR);
    const at = navbar.indexOf("setPhoneSearchOpen((open) => !open)");
    expect(at, "the phone search icon is gone").toBeGreaterThan(-1);
    const icon = navbar.slice(at - 700, at);

    expect(icon, "the icon is hidden on phones again").toContain("sm:hidden");
    expect(icon).not.toContain("sm:flex");
  });

  it("and tapping it gives a phone somewhere to type, rather than a page", () => {
    /**
     * THE SHOP REPORTED THIS ONE. The single search control a phone has was
     * `<Link href={routes.store.collections}>` — it left the page and landed
     * on the unfiltered grid, with nothing to type into at the other end. A
     * control labelled Search that cannot search.
     *
     * Two guards, because either alone passes for the wrong reason: that no
     * search control still navigates to a bare collections page, and that the
     * form the icon reveals is the SAME form the desktop uses. A second form
     * with a second input would pass a "there is a box on a phone" test while
     * duplicating every keyboard handler in this file — the two search
     * haystacks in this codebase are what that drift looks like a year on.
     */
    const navbar = code(NAVBAR);

    expect(
      navbar.includes('href={routes.store.collections} aria-label="Search"'),
      "the phone search icon navigates to the collections page again",
    ).toBe(false);
    /*
      The drawer row was the same broken promise and is checked by what it is
      now, not by what it is not: `href={routes.store.collections}` is still
      legitimately in this file twice — the form posts to it and the nav band
      links to it — so a blanket ban on the string would be a guard that can
      only be satisfied by breaking the header.
    */
    const drawer = navbar.slice(navbar.indexOf('id="storefront-mobile-nav"'));
    expect(drawer, "the drawer has no Search row at all").toContain("setPhoneSearchOpen(true)");

    expect((navbar.match(/<form/g) ?? []).length, "there is a second search form").toBe(1);
    expect(
      (navbar.match(/type="search"/g) ?? []).length,
      "there is a second search input",
    ).toBe(1);
    expect(navbar, "the form has no phone state at all").toContain("phoneSearchOpen");
  });
});

describe("the nav is its own full-width strip", () => {
  it("sits outside the main bar rather than inside it", () => {
    /**
     * Inline in a 64px bar beside the logo and the icon cluster, eleven
     * categories plus a promoted item do not fit — which is what made the
     * per-row emphasis pointless before this.
     *
     * Asserted by ORDER: the strip's own wrapper must come after the main bar
     * closes, not within it.
     */
    const navbar = code(NAVBAR);
    /*
      `data-header-bar` rather than the row's class string. The invariant is
      ORDER — the strip comes after the bar — and the previous anchor pinned
      the bar's height and container width as a side effect, so a restyle
      reddened a test with no opinion about either.
    */
    const mainBar = navbar.indexOf("data-header-bar");
    const strip = navbar.indexOf('aria-label="Shop categories"');

    expect(mainBar, "the main bar lost its marker").toBeGreaterThan(-1);
    expect(strip, "the category strip is gone").toBeGreaterThan(-1);
    expect(strip, "the nav is still inside the main bar").toBeGreaterThan(mainBar);
  });

  it("and is hidden on a phone, where the same rows are in the drawer", () => {
    const navbar = code(NAVBAR);
    // Marker, not fill: this case is about the band being hidden on a phone,
    // and `bg-cream-50` is a colour the reference restyle changes.
    const at = navbar.indexOf("data-nav-band");
    expect(at, "the nav band lost its marker").toBeGreaterThan(-1);
    const band = navbar.slice(at, at + 200);

    /*
      HIDDEN ON A PHONE, AND SHOWN SOMEHOW FROM lg — not `lg:block`.

      This read `toContain("lg:block")`, and `block` was never the point: the
      case is that a phone gets no band. The band became a grid so its height
      could animate from `1fr` to `0fr` when it slides out of the way, which
      turned this red on code that hides it from phones exactly as before.

      Both halves are asserted, because `hidden` alone passes for a band that
      is hidden everywhere and the `lg:` rule alone passes for one that is on
      a phone too.
    */
    expect(band, "the band is not hidden by default, so a phone gets one").toContain("hidden");
    expect(band, "the band is never shown from lg").toMatch(/lg:(block|grid|flex)\b/);
  });
});

describe("the category tiles are squares, not circles", () => {
  it("keeps the whole picture rather than cropping it to a circle", () => {
    /**
     * A circle crops a product photograph to its middle: a bouquet loses its
     * stems, a boxed gift loses its corners. The reference strip is rounded
     * squares for exactly that reason, and this shop sells things that are not
     * round.
     */
    const renderer = code("features/cms-sections/homepage-section-renderer.tsx");
    /*
      THE FUNCTION, not 2,600 characters of whatever follows it.

      OurMenuSection measures about 1,800, so the fixed window already ran
      800 characters into the next section's docblock — and it would keep
      passing if the tiles moved out of this function entirely, because the
      window would still be full of somebody else's markup.
    */
    const at = renderer.indexOf("function OurMenuSection");
    expect(at, "OurMenuSection is gone").toBeGreaterThan(-1);
    const rest = renderer.slice(at + 1);
    const next = rest.search(/\n(?:export )?(?:function|const) /);
    const strip = next < 0 ? rest : rest.slice(0, next);

    expect(strip, "the slice ran past OurMenuSection").not.toContain(
      "function StoreLocatorSection",
    );
    expect(strip).toContain("rounded-2xl");
    expect(strip, "the tiles are circles again").not.toContain("rounded-full");
  });
});
