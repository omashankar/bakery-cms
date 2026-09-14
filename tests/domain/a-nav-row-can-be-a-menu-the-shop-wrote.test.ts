/**
 * ACCEPTANCE TEST 4: "Create a new Mega Menu group. Verify it appears in
 * storefront."
 *
 * The spec asked for EXPRESS, CAKES, FLOWERS, PLANTS, GIFTS as nav items, each
 * with its own mega menu, each menu made of groups the shop writes — "Cakes By
 * Type", "Cakes By Flavour", "Cakes By Theme", "Gifts For Him". And it said,
 * in as many words: do NOT hard-code these structures.
 *
 * What existed was one menu, on one nav row, with two columns headed "Shop by
 * Category" and "Shop by Occasion" — headings written in the component. A shop
 * could change what was IN those columns and nothing else: not what they were
 * called, not how many there were, not which nav item they hung from. The
 * FLOWERS row could only ever be a plain link.
 *
 * The rule this file pins is the one the spec is really about: what the menu
 * shows must be a function of what the shop wrote, and a shop that wrote
 * nothing must be exactly where it was.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { drawableGroups } from "@/components/storefront/mega-menu";
import { NAV_ICONS, navIcon } from "@/config/nav-icons";
import { headerSchema } from "@/features/site-layout/server/site-layout.validators";
import type { MegaMenuGroup } from "@/types/site-layout";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function group(overrides: Partial<MegaMenuGroup> = {}): MegaMenuGroup {
  return {
    id: "grp-1",
    heading: "Cakes By Flavour",
    sortOrder: 1,
    isVisible: true,
    links: [{ id: "lnk-1", label: "Chocolate Cakes", href: "/store/collections/chocolate" }],
    ...overrides,
  };
}

describe("the groups a menu actually draws", () => {
  it("keeps a group the shop wrote", () => {
    expect(drawableGroups([group()]).map((g) => g.heading)).toEqual(["Cakes By Flavour"]);
  });

  it("draws them in the shop's order, not the order they were typed", () => {
    /**
     * The spec lists "group order" among the things the CMS must control. The
     * admin's Add button appends, so without this the order is the order of
     * creation and a shop can never put its most important column first.
     */
    const drawn = drawableGroups([
      group({ id: "b", heading: "By Theme", sortOrder: 2 }),
      group({ id: "a", heading: "By Flavour", sortOrder: 1 }),
    ]);

    expect(drawn.map((g) => g.heading)).toEqual(["By Flavour", "By Theme"]);
  });

  it("drops a group the shop switched off", () => {
    expect(drawableGroups([group({ isVisible: false })])).toEqual([]);
  });

  it("drops a group with nothing in it", () => {
    /**
     * A heading over an empty list reads as something that failed to load —
     * the same rule the Occasion column and every filter box now follow. It
     * also happens constantly in the admin: Add group, then go and find the
     * links.
     */
    expect(drawableGroups([group({ links: [] })])).toEqual([]);
  });

  it("says nothing at all for a row the shop never touched", () => {
    // Absent, which is every nav row in every shop the day this shipped.
    expect(drawableGroups(undefined)).toEqual([]);
    expect(drawableGroups([])).toEqual([]);
  });
});

describe("a menu survives the round trip to the database", () => {
  /**
   * The endpoint takes a hand-editable file through backup restore, and this
   * repo has been bitten by a field that validated, persisted and then was not
   * there. The storage is `data: Mixed` so strict mode cannot drop it — the
   * risk here is the SCHEMA, which strips what it does not declare.
   */
  const header = {
    logoLetter: "",
    nav: [
      {
        id: "nav-cakes",
        label: "CAKES",
        href: "/store/collections/cakes",
        isVisible: true,
        sortOrder: 1,
        menu: [
          {
            id: "grp-flavour",
            heading: "Cakes By Flavour",
            sortOrder: 1,
            isVisible: true,
            links: [
              {
                id: "lnk-choc",
                label: "Chocolate Cakes",
                href: "/store/collections/chocolate",
                badge: "New",
              },
            ],
          },
        ],
      },
    ],
  };

  it("accepts a nav row carrying its own menu, links and badges", () => {
    const parsed = headerSchema.parse(header) as typeof header;

    expect(parsed.nav[0].menu?.[0]?.heading).toBe("Cakes By Flavour");
    expect(parsed.nav[0].menu?.[0]?.links[0]?.href).toBe("/store/collections/chocolate");
    expect(parsed.nav[0].menu?.[0]?.links[0]?.badge).toBe("New");
  });

  it("leaves a row with no menu WITHOUT one, rather than giving it an empty one", () => {
    /**
     * Load-bearing, and the reason `menu` is `.optional()` and not
     * `.default([])`.
     *
     * Absent means "this row is a plain link". Empty means "this row has a menu
     * the shop emptied". Defaulting would erase the difference on every save —
     * and worse, would hand every existing row a menu, which the renderer draws
     * INSTEAD of the taxonomy columns the Collections row has always shown. On
     * the day this shipped, every shop's Shop menu would have gone blank.
     */
    const parsed = headerSchema.parse({
      logoLetter: "",
      nav: [{ id: "nav-home", label: "Home", href: "/store", isVisible: true, sortOrder: 1 }],
    }) as { nav: { menu?: unknown }[] };

    expect("menu" in parsed.nav[0] && parsed.nav[0].menu !== undefined).toBe(false);
  });
});

describe("both menus draw it, and the shop that wrote none is untouched", () => {
  it("the navbar turns any row with groups into a menu, on desktop and on the phone", () => {
    /**
     * TWO call sites, because this repo renders its nav twice and has shipped a
     * phone menu that differed from the desktop one more than once. The phone
     * is the one an Indian shop's customers actually use.
     */
    const navbar = code("apps/website/components/storefront-navbar.tsx");

    /*
      THE TWO PLACES, not a count of two.

      This asserted `=== 2` occurrences, which says nothing about WHERE they
      are — two calls in the desktop band would have satisfied it with the
      phone drawing plain links — and forbids a third legitimate one. It
      started failing the moment the taxonomy row joined the same map and
      had to ask the same question. Sliced at the two markers instead, so
      the case now fails for the reason it is named after.
    */
    const bandAt = navbar.indexOf("data-nav-band");
    const drawerAt = navbar.indexOf('id="storefront-mobile-nav"');
    expect(bandAt, "the desktop band is gone").toBeGreaterThan(-1);
    expect(drawerAt, "the phone drawer is gone").toBeGreaterThan(bandAt);

    const band = navbar.slice(bandAt, drawerAt);
    const drawer = navbar.slice(drawerAt);

    expect(band, "the desktop band ignores a row's groups").toContain(
      "drawableGroups(item.menu)",
    );
    expect(drawer, "the phone drawer ignores a row's groups").toContain(
      "drawableGroups(item.menu)",
    );
    expect(band).toContain("groups={item.menu}");
    expect(drawer).toContain("groups={item.menu}");
  });

  it("and the Collections row with no groups still draws the shop's taxonomy", () => {
    /**
     * The compatibility half. Every shop has this row and none of them has
     * written a menu, so if the authored path were unconditional the header
     * would empty out on deploy.
     */
    const menu = code("components/storefront/mega-menu.tsx");

    expect(menu).toContain("authored.length > 0 ? (");
    // The fallback columns are still there, under the authored branch.
    expect(menu).toContain("Shop by Category");
    expect(menu).toContain("Shop by Occasion");
  });

  it("and the menu's own trigger goes where the row goes", () => {
    /**
     * It was hardcoded to the collections page, so a CAKES row and a GIFTS row
     * would both have opened the same page — the one thing that makes a
     * per-row menu meaningless.
     */
    const menu = code("components/storefront/mega-menu.tsx");

    expect(menu).toContain("href = routes.store.collections");
    expect(menu).toMatch(/<Link\s+href=\{href\}/);
  });

  it("and nothing in the menu names a trade", () => {
    /**
     * The spec's §24. The component may no longer carry a word about what the
     * shop sells: the groups are the shop's, the fallback columns are generic,
     * and the only bakery token left in this file is the colour palette's name.
     */
    const menu = code("components/storefront/mega-menu.tsx").replace(/bakery-\d+/g, "");

    expect(menu).not.toMatch(/\bcakes?\b|\beggless\b|\bphoto-cakes\b/i);
  });
});

describe("a row the shop wants noticed", () => {
  /**
   * The reference header leads with EXPRESS in the brand colour and ends with a
   * promoted "2 Hour Delivery Gifts" behind a divider, carrying a van icon.
   *
   * A nav row could express label, href, visibility and order. None of the four
   * things that make one row stand out from the other eleven existed, so the
   * only way to build that header was to write it into the component — which is
   * what the design rule this whole project is about forbids.
   *
   * All four are OPTIONAL and inert when unset: a row nobody has touched renders
   * exactly as it did, which is every row in every shop today.
   */
  const promoted = {
    logoLetter: "",
    nav: [
      {
        id: "nav-express",
        label: "EXPRESS",
        href: "/store/collections",
        isVisible: true,
        sortOrder: 1,
        highlight: true,
        icon: "Truck",
        badge: "2 Hour",
        dividerBefore: true,
      },
    ],
  };

  it("keeps all four through the schema", () => {
    const parsed = headerSchema.parse(promoted) as typeof promoted;

    expect(parsed.nav[0].highlight).toBe(true);
    expect(parsed.nav[0].icon).toBe("Truck");
    expect(parsed.nav[0].badge).toBe("2 Hour");
    expect(parsed.nav[0].dividerBefore).toBe(true);
  });

  it("and gives a row that sets none of them none of them", () => {
    /**
     * Not `false`, not `""` — ABSENT. A default would write emphasis onto every
     * row in every shop on the day this shipped, and "highlighted" on all twelve
     * rows is the same as highlighted on none.
     */
    const parsed = headerSchema.parse({
      logoLetter: "",
      nav: [{ id: "n", label: "CAKES", href: "/store", isVisible: true, sortOrder: 1 }],
    }) as { nav: Record<string, unknown>[] };

    for (const key of ["highlight", "icon", "badge", "dividerBefore"]) {
      expect(parsed.nav[0][key], `${key} was defaulted onto an untouched row`).toBeUndefined();
    }
  });

  it("renders an icon the build knows and nothing for one it does not", () => {
    /**
     * The value crosses the wire from MongoDB and is typed by an admin. This is
     * the header of every storefront page, outside the try/catch that guards the
     * chrome read — an unknown name must render no icon, never throw.
     */
    expect(navIcon("Truck")).toBeTruthy();
    expect(navIcon("DefinitelyNotAnIcon")).toBeNull();
    expect(navIcon(undefined)).toBeNull();
  });

  it("offers only icons that mean something in any trade", () => {
    /**
     * Six, deliberately. A picker of four hundred lucide icons is a worse
     * control than six that fit a header — and every one of these is generic:
     * a van, a clock, a gift, a spark, a flame, a tag. None names a trade.
     */
    const names = Object.keys(NAV_ICONS);

    expect(names.length).toBeLessThanOrEqual(8);
    expect(names.join(" ")).not.toMatch(/cake|bakery|flower|plant/i);
  });

  it("draws all four on the phone as well as on the desktop", () => {
    /**
     * A header that differs by screen size is two headers, and the phone is the
     * one an Indian shop's customers actually use.
     */
    const navbar = code("apps/website/components/storefront-navbar.tsx");

    /*
      `\\.` in a normal string is just `.`, and String.replace with a string
      pattern changes the FIRST occurrence only — so this built the regex
      /item.highlight/, where the dot matches any character. It counted
      `itemXhighlight` as readily as the thing it was looking for. String.raw
      keeps the backslash, and the /g on the replace covers every dot.
    */
    for (const field of ["item.highlight", "item.badge", "item.dividerBefore"]) {
      expect(
        (navbar.match(new RegExp(field.replace(/\./g, String.raw`\.`), "g")) ?? []).length,
        `${field} is drawn in only one of the two menus`,
      ).toBeGreaterThanOrEqual(2);
    }
    expect((navbar.match(/navIcon\(item\.icon\)/g) ?? []).length).toBe(2);
  });

  it("and the admin can set every one of them", () => {
    const admin = code("apps/admin/header/components/header-admin-page.tsx");

    expect(admin).toContain("highlight: checked || undefined");
    expect(admin).toContain("dividerBefore: checked || undefined");
    expect(admin).toContain("badge: e.target.value || undefined");
    expect(admin).toContain("icon: e.target.value || undefined");
    // The icon list is the render's own allowlist, so the two cannot drift.
    expect(admin).toContain("Object.keys(NAV_ICONS)");
  });
});
