import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { panelShape } from "@/components/storefront/mega-menu";

/**
 * THE BAND A CUSTOMER COULD NOT SEE.
 *
 * The category strip was built as its own full-width band under the main bar,
 * with a comment describing a pale strip separating the logo row from the page.
 * A customer saw no band at all: its fill was `bg-cream-50/60`, and `--cream-50`
 * is defined as `#ffffff` — in globals.css, and again in appearance-tokens for
 * every palette a shop can pick — so it painted white at 60% opacity over the
 * white header above it.
 *
 * The rest of this file is the other four things that band was doing wrong, all
 * of which only mattered once it was visible.
 */
/**
 * Read with the line endings normalised.
 *
 * This repo stores LF and checks out CRLF, so an assertion anchored on a
 * newline matches right after a patch script writes the file and stops matching
 * the next time git touches it — which is exactly how this file first went red
 * on code that was correct.
 */
const read = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8")
    .split(String.fromCharCode(13, 10))
    .join(String.fromCharCode(10));
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const NAVBAR = "apps/website/components/storefront-navbar.tsx";
const MENU = "components/storefront/mega-menu.tsx";
const CSS = "app/globals.css";
const TOKENS = "features/site-layout/lib/appearance-tokens.ts";

/** The band's own markup, from its marker to the drawer that follows it. */
function bandOf(navbar: string) {
  const at = navbar.indexOf("data-nav-band");
  expect(at, "the nav band lost its marker").toBeGreaterThan(-1);
  const end = navbar.indexOf('id="storefront-mobile-nav"');
  expect(end, "the phone drawer is gone").toBeGreaterThan(at);
  return navbar.slice(at, end);
}

describe("the band a customer can actually see", () => {
  it("is not filled with the token that means white", () => {
    /**
     * Both definitions checked, because either one alone would let the other
     * quietly become the real answer — and the appearance one is the live
     * value on any shop that has picked a palette.
     */
    expect(read(CSS)).toContain("--cream-50: #ffffff;");
    expect(read(TOKENS)).toContain('"--cream-50": "#ffffff"');

    const band = bandOf(code(NAVBAR));
    expect(band.slice(0, 400), "the band is white on white again").not.toContain(
      "bg-cream-50",
    );
  });

  it("is filled with the shop's own surface colour", () => {
    // `--cream-100` maps to the shop's `surfaceColor` in appearance-tokens, so
    // the tint tracks whatever palette the shop picked rather than being a grey
    // this file chose for it.
    expect(read(TOKENS)).toContain('"--cream-100": surfaceColor');

    const band = bandOf(code(NAVBAR));
    expect(band.slice(0, 400)).toContain("bg-cream-100");
  });

  it("is closed by a hairline above and below", () => {
    const band = bandOf(code(NAVBAR));
    expect(band.slice(0, 400)).toContain("border-y");
  });

  it("and the header no longer draws a border on the same edge", () => {
    /**
     * The header's own `border-b` appeared on scroll, directly under the band's
     * new bottom hairline — two 1px lines stacked into one 2px line the moment
     * anybody scrolled. It says the same thing with a shadow.
     */
    const navbar = code(NAVBAR);
    /*
      THE ELEMENT'S OWN CLASSNAME, not everything down to the main bar — the
      utility strip sits in between and legitimately carries a `border-b` of
      its own, which made the first version of this assertion fail on a
      header that was already correct.
    */
    const at = navbar.indexOf("<header");
    expect(at, "the header element is gone").toBeGreaterThan(-1);
    const header = navbar.slice(at, navbar.indexOf(">", at));

    expect(header).toContain("shadow-");
    expect(header, "the header still borders the same edge as the band").not.toMatch(
      /border-b/,
    );
  });

  it("does not render at all when the shop has hidden every row", () => {
    /**
     * A hairline and 12px of padding with nothing between them, under the main
     * bar of every desktop page. Invisible while the fill was white on white;
     * a grey bar of nothing the moment the fill became real — so this had to
     * land with the fill, not after it.
     */
    const navbar = code(NAVBAR);
    expect(navbar).toMatch(/\{bandRows\.length > 0 \? \(/);
  });
});

describe("what a row loses by gaining a menu", () => {
  it("nothing: the four promoted fields travel to the menu too", () => {
    /**
     * The admin offers Highlight, Icon and Badge on EVERY nav row, with no hint
     * that a row behaves differently once it has groups — and the navbar passed
     * none of them to MegaMenu, so a shop that gave its promoted row a dropdown
     * lost its emphasis, its icon and its badge with no warning anywhere. The
     * reference layout's first item is a highlighted category, which is exactly
     * the row a shop is most likely to give a menu.
     */
    const menu = code(MENU);
    for (const prop of ["highlight", "icon", "badge"]) {
      expect(menu, `MegaMenu cannot be told about \`${prop}\``).toContain(`${prop},`);
    }
    /*
      THE HELPER'S BODY TOO. Asserting the call site alone passed with
      `rowIcon` gutted to `return null` — the trigger still called it, and
      still drew nothing.
    */
    expect(menu, "the menu trigger does not call for an icon").toContain(
      "rowIcon(icon)",
    );
    const helper = menu.slice(menu.indexOf("function rowIcon("));
    expect(helper.slice(0, 200), "rowIcon looks nothing up").toContain("navIcon(name)");
    expect(helper.slice(0, 200), "rowIcon renders nothing").toContain("<Icon ");
    expect(menu, "the menu trigger draws no badge").toContain("{badge}");
    expect(menu, "the menu trigger ignores the shop's emphasis").toMatch(
      /highlight[\s\S]{0,120}font-semibold/,
    );

    /*
      BOTH MENU BRANCHES. The band renders a MegaMenu twice — once for the
      taxonomy row, once for a row whose groups the shop wrote — and
      `toContain` passed with either one stripped of all three props. Counted
      instead, so dropping one branch's emphasis is a failure rather than a
      half that happens not to be the half being read.
    */
    const band = bandOf(code(NAVBAR));
    for (const prop of ["highlight={item.highlight}", "icon={item.icon}", "badge={item.badge}"]) {
      expect(
        (band.split(prop).length - 1),
        `only one of the band's two menu branches passes ${prop}`,
      ).toBe(2);
    }
  });

  it("and its divider, which the type says belongs to the row", () => {
    // types/site-layout.ts states the divider is a row property specifically so
    // that hiding or reordering the row takes its separator with it. It was
    // rendered inside the plain-link branch only, so a row with a menu left its
    // divider floating with nothing after it.
    const band = bandOf(code(NAVBAR));
    const beforeBranch = band.slice(0, band.indexOf("if (item.href === routes.store.collections"));

    expect(beforeBranch, "the divider is still inside one branch").toContain("const divider =");
    expect((band.match(/\{divider\}/g) ?? []).length, "a branch draws no divider").toBe(3);
  });
});

describe("where the taxonomy menu sits in the row", () => {
  it("is decided by the shop's own order, not by being rendered first", () => {
    /**
     * It was rendered before the map and filtered out of it, so it was pinned
     * to the head of the band whatever the admin's reorder arrows said — and
     * the reference layout leads with a highlighted express row, which a shop
     * therefore could not have while it kept its Collections row.
     */
    const band = bandOf(code(NAVBAR));

    expect(band).toContain("bandRows.map((item, index)");
    expect(band).toContain("item.href === routes.store.collections");
    expect(
      band.slice(0, band.indexOf("bandRows.map")),
      "the taxonomy menu is rendered before the list again",
    ).not.toContain("<MegaMenu");
  });

  it("and Home still never appears in it, because the logo is the way home", () => {
    const navbar = code(NAVBAR);
    expect(navbar).toMatch(
      /const bandRows = navItems\.filter\(\(item\) => item\.href !== routes\.store\.home\)/,
    );
  });
});

describe("the menu panel's own edges", () => {
  it("can never be wider than the window", () => {
    /**
     * A fixed 640px panel anchored to `left-0`. The band appears at lg, where
     * the content column is 960px — so a trigger more than 320px along, which
     * is the fourth row of a seven-row nav, pushed the panel past the window
     * and gave the whole storefront a horizontal scrollbar.
     *
     * THE CAP STAYED; THE LITERAL WENT. The width is now chosen from what the
     * panel is about to draw, with 40rem — the 640px this always was — as the
     * ceiling, so no shop's panel is wider than it used to be. Asserting the
     * old string here would pin a number the file no longer writes.
     */
    const menu = code(MENU);
    expect(menu, "the panel is a fixed width again").not.toContain("w-[640px]");
    expect(menu, "the panel lost its window cap").toContain("calc(100vw-2rem)");
  });

  it("and is only as wide as the columns it has to hold", () => {
    /**
     * ASSERTED BY RETURN VALUE, not by the text of a className — which is the
     * check that passes for a file that computes a width and never applies
     * it. Every one of these numbers goes red if `LINK_COLUMN_REM` is
     * flattened back to one width, while a `toContain` on the class strings
     * would not: they are all still in the source.
     *
     * The bug being pinned is not the panel being too narrow. It is one group
     * rendering as a single 592px column inside a 640px card, because
     * `auto-fit` collapses the tracks it has no items for and `1fr` takes
     * the space — which is what a brand-new shop's menu, holding one link,
     * looked like.
     */
    expect(panelShape(1).width, "one column still opens a 640px card").toContain("15rem");
    expect(panelShape(1).columns).toBe(1);
    expect(panelShape(2).width).toContain("27rem");
    expect(panelShape(2).columns).toBe(2);

    // Three is the ceiling, and the ceiling is exactly what it always was.
    expect(panelShape(3).width).toContain("40rem");
    expect(panelShape(9).width, "a fourth group widened the panel").toContain("40rem");
    expect(panelShape(9).columns, "more than three tracks in one row").toBe(3);

    // The picture card is 200px plus the grid's gap, and still clamps.
    expect(panelShape(1, true).width).toContain("29rem");
    expect(panelShape(3, true).width).toContain("40rem");
  });

  it("and hangs from whichever edge keeps it on screen", () => {
    const menu = code(MENU);
    expect(menu).toMatch(/align === "right" \? "right-0" : "left-0"/);

    const band = bandOf(code(NAVBAR));
    expect(band, "every panel still hangs from the left").toContain("align={align}");
    expect(band).toMatch(/index >= Math\.floor\(bandRows\.length \/ 2\)/);
  });

  it("and a short band opens its menu under its own trigger", () => {
    /**
     * THE ONE THAT WAS BROKEN WHILE THE CASE ABOVE STAYED GREEN.
     *
     * `index >= floor(n/2)` assumed a full band. Home is not in the band, so
     * a shop with Home and Collections visible has one row: `0 >= floor(1/2)`
     * is true, its only menu is anchored `right-0` to a trigger near the left
     * edge, and the panel opens off-screen to the LEFT. Measured on this
     * shop's own storefront before the fix — left edge at -469px, 469 of
     * 640px unreachable.
     *
     * Nothing caught it because off-screen LEFT adds nothing to
     * `scrollWidth` in LTR, so even the guard that exists to catch a panel
     * leaving the window could not see it. This is the source half; the
     * browser half is tests/e2e/a-menu-opens-inside-the-window.spec.ts.
     */
    const band = bandOf(code(NAVBAR));
    expect(band, "a one-row band right-anchors its only panel again").toMatch(
      /bandRows\.length >= 6 &&/,
    );
  });
});

describe("the words in the band", () => {
  it("are uppercase and letter-spaced, in both halves of it", () => {
    /**
     * Both, because the band is drawn by two components — a plain Link for a
     * row with no menu and MegaMenu's trigger for one with — and a rule applied
     * to one of them is a row of eleven links in two different styles.
     *
     * The transform is CSS, so the stored label is still exactly what the shop
     * typed in the Header screen.
     */
    const band = bandOf(code(NAVBAR));
    const trigger = code(MENU);

    expect(band, "the plain rows are sentence case").toContain("uppercase tracking-[0.08em]");
    expect(trigger, "the menu triggers are sentence case").toContain(
      "uppercase tracking-[0.08em]",
    );
  });

  it("and a promoted row is bolder, not only brand-coloured", () => {
    // Eleven neighbours at the same weight swallow a colour change, and the
    // colour in question is the shop's own primary — which on a pale palette
    // is a small step from muted foreground.
    const band = bandOf(code(NAVBAR));
    expect(band).toMatch(/item\.highlight[\s\S]{0,80}font-semibold/);
  });

  it("and the shop's emphasis still beats the route's", () => {
    // A promoted row reads as promoted whether or not you are standing on it.
    /*
      The CLASS ternary, found by its own shape. `indexOf("item.highlight")`
      lands on the prop being passed to the taxonomy menu three branches
      earlier, and a slice from there contains neither arm — so the first
      version of this compared -1 with -1 and could never have failed.
    */
    const band = bandOf(code(NAVBAR));
    const at = band.indexOf('item.highlight\n');
    expect(at, "the plain rows no longer branch on the shop's emphasis").toBeGreaterThan(-1);
    const branch = band.slice(at, at + 300);

    expect(branch).toContain("font-semibold");
    expect(branch.indexOf("font-semibold")).toBeLessThan(branch.indexOf("isActive"));
  });
});

describe("the phone drawer this band hides behind", () => {
  it("has a ceiling, and scrolls inside it", () => {
    /**
     * The drawer is plain in-flow content, and `useBodyScrollLock` sets
     * `overflow: hidden` on the body while it is open — so anything past the
     * fold could not be reached at all. With this shop's seven nav rows it
     * already ran past a 667px phone, which put the wishlist/cart/account row
     * — and the only way to sign in on a phone — below a fold nobody could
     * scroll to.
     *
     * `dvh`, because mobile browser chrome collapses on scroll and `vh` is
     * measured against the taller state.
     */
    const navbar = code(NAVBAR);
    const at = navbar.indexOf('id="storefront-mobile-nav"');
    expect(at, "the drawer is gone").toBeGreaterThan(-1);
    const drawer = navbar.slice(at, at + 400);

    expect(drawer, "the drawer can still run past the fold").toMatch(/max-h-\[/);
    expect(drawer).toContain("overflow-y-auto");
    expect(drawer, "vh is measured against the taller chrome").toContain("dvh");
  });

  it("no longer carries a utility row, because there is not one", () => {
    /*
      It used to, and that was the fix: the row's own band is
      `hidden … lg:block`, so before the drawer drew it those links existed
      only on a desktop.

      The row itself went at the shop's request. Scoped to the DRAWER rather
      than the file, so this stays a statement about the phone: if the row
      comes back anywhere, the case in
      the-header-has-the-rows-the-reference-has catches it, and if it comes
      back HERE, this one does.
    */
    const navbar = code(NAVBAR);
    const drawer = navbar.slice(navbar.indexOf('id="storefront-mobile-nav"'));
    expect(drawer.length, "the drawer is gone").toBeGreaterThan(0);

    expect(drawer, "the phone draws a utility row again").not.toContain("utilityNav");
    expect(drawer).not.toContain("currencyNote");
  });
});

describe("a divider before the first row", () => {
  it("is not drawn, because it would separate that row from nothing", () => {
    const navbar = code(NAVBAR);
    expect((navbar.match(/item\.dividerBefore && index > 0/g) ?? []).length).toBe(2);
  });
});
