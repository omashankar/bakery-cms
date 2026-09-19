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

describe("the utility row above the main bar", () => {
  it("is a list the shop writes, validated like the nav below it", () => {
    const parsed = headerSchema.parse({
      logoLetter: "",
      nav: [],
      utilityNav: [
        { id: "u1", label: "Track Order", href: "/store/order/track", isVisible: true, sortOrder: 1 },
      ],
      showCurrencyNote: true,
    }) as { utilityNav?: { label: string }[]; showCurrencyNote?: boolean };

    expect(parsed.utilityNav?.[0]?.label).toBe("Track Order");
    expect(parsed.showCurrencyNote).toBe(true);
  });

  it("ships EMPTY, so a shop that never opens the screen has no second row", () => {
    /**
     * Unlike `nav`, which is seeded from the shipped navigation because a shop
     * cannot have no navigation at all. A seeded utility row would put Help and
     * Corporate Gifts links on every storefront pointing at pages nobody wrote.
     */
    expect(defaultHeaderSettings.utilityNav).toEqual([]);
    expect(defaultHeaderSettings.showCurrencyNote).toBe(false);
  });

  it("renders nothing at all when there is nothing in it", () => {
    const navbar = code(NAVBAR);

    expect(navbar).toContain("utilityNav.length > 0 || currencyNote");
  });

  it("hides a link the shop switched off, and keeps the order it set", () => {
    /**
     * The same `selectVisibleNavItems` the main row goes through. Reading the
     * raw array here would make a hidden utility link visible and an ordered
     * one arbitrary — the exact pair of bugs that filter was written for.
     */
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");

    expect(chrome).toContain("selectVisibleNavItems(header.utilityNav ?? [])");
  });
});

describe("the currency line is a readout, not a switcher", () => {
  /**
   * Currency is ONE shop-wide setting published into a process-global locale;
   * `formatCurrency` is synchronous across hundreds of call sites in two module
   * graphs; and the payment gateway takes rupees only. A control that looked
   * like a switcher would charge the customer in INR regardless — a lie with a
   * dropdown on it.
   *
   * Saying which currency the prices are in is true and useful. That is what
   * this is, and the test is here so nobody "finishes" it later.
   */
  it("prints the shop's own currency and offers no way to change it", () => {
    const navbar = code(NAVBAR);
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");

    expect(chrome).toContain("header.showCurrencyNote");
    expect(chrome).toContain("general.currency");

    /**
     * THE WHOLE ROW, not the gap between two markers.
     *
     * It sliced from `currencyNote ? (` to `utilityNav.map` — two markers in
     * a fixed order today, and `String.slice(a, b)` with b < a returns the
     * empty string. Move the links above the readout, which is an ordinary
     * layout change, and the guard passes by measuring nothing. Anchored on
     * the row's own opening test and the next band instead, so it covers the
     * readout wherever inside the row it sits.
     */
    const start = navbar.indexOf("utilityNav.length > 0 || currencyNote");
    const end = navbar.indexOf("data-header-bar");
    expect(start, "the utility row is gone").toBeGreaterThan(-1);
    expect(end, "the main bar is gone").toBeGreaterThan(start);

    const row = navbar.slice(start, end);
    expect(row, "the readout is no longer in the row being checked").toContain(
      "{currencyNote}",
    );
    expect(row).not.toMatch(/<select|onChange|onClick/);
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
     */
    const navbar = code(NAVBAR);
    const at = navbar.indexOf('href={routes.store.collections} aria-label="Search"');
    expect(at, "the phone search icon is gone").toBeGreaterThan(-1);
    const icon = navbar.slice(at - 400, at);

    expect(icon, "the icon is hidden on phones again").toContain("sm:hidden");
    expect(icon).not.toContain("sm:flex");
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

    expect(navbar.slice(at, at + 200)).toContain("lg:block");
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
