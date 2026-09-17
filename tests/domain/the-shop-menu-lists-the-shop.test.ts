/**
 * THE SHOP MENU LISTS THE SHOP, NOT A BAKERY SOMEBODY WROTE IN A CONSTANT.
 *
 * `constants/storefront-nav.ts` held the whole Shop menu: seven category links,
 * three occasion links and a fixed promo card. The file said the problem out
 * loud in a comment above the occasions — "These are hardcoded, and the
 * catalogue they point into is not" — and then kept going.
 *
 * Every row was a promise the constant could not keep. A shop with no
 * `photo-cakes` category served a row that opened an empty grid. A shop that
 * created "Succulents" got no row. A florist got five cake pages. And the
 * occasion column was three bakery words for every trade on the platform,
 * while the shop's OWN occasions — a real, populated membership axis — went
 * unlinked.
 *
 * These cases are about the rule, not the current data: the menu must be a
 * function of what the shop has, and must say nothing when the shop has
 * nothing.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/** Comments quoting the old constant are not the old constant. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the menu's data comes from the shop", () => {
  it("no longer ships a hardcoded menu to import", async () => {
    /**
     * Asserted on the MODULE, not on the file's text: an export that is gone
     * cannot be resurrected by a comment, and a rename would fail here too.
     */
    const nav = await import("@/constants/storefront-nav");

    expect("shopMegaMenu" in nav, "the hardcoded menu is back").toBe(false);
  });

  it("and nothing anywhere still reads one", () => {
    for (const path of [
      "components/storefront/mega-menu.tsx",
      "apps/website/components/storefront-navbar.tsx",
    ]) {
      expect(code(path), `${path} still reads a hardcoded menu`).not.toContain("shopMegaMenu");
    }
  });

  it("carries the shop's occasions all the way from the server to both menus", () => {
    /**
     * FOUR files, because that is how far a new field has to travel here and
     * every one of them is a place it can be dropped in silence. The chrome
     * type, the read, the desktop menu and the phone one.
     *
     * The phone is the one that matters most and the one that had no occasion
     * column at all before this — "the mobile view is the one an Indian shop
     * owner actually uses", and a menu that differs by screen size is two
     * menus.
     */
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome).toContain("getStorefrontOccasions");
    expect(chrome, "occasions are not on the chrome the navbar receives").toMatch(
      /occasions:\s*\{ id: string; name: string; slug: string \}\[\]/,
    );

    const navbar = code("apps/website/components/storefront-navbar.tsx");
    // Both call sites: MegaMenu (desktop) and MobileShopLinks (phone).
    expect(navbar.match(/occasions=\{chrome\.occasions\}/g) ?? []).toHaveLength(2);
  });

  it("reads them in the same round trip as the categories", () => {
    /**
     * Not a fresh `await`. The categories read was once a serial await further
     * down this function and put a whole extra round trip on the critical path
     * of every storefront render; the comment recording that is still there.
     * A second taxonomy read is exactly the same mistake available twice.
     */
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    const all = chrome.slice(chrome.indexOf("Promise.all(["), chrome.indexOf("]);"));

    expect(all).toContain("getStorefrontCategories()");
    expect(all).toContain("getStorefrontOccasions()");
  });
});

describe("a shop with nothing of its own is shown nothing of anyone else's", () => {
  it("falls back to rows that are true for any trade", () => {
    /**
     * The fallback renders only while a shop has no categories yet — which is
     * exactly a brand-new non-bakery shop, the one that must not be handed a
     * menu of cake pages. What is left is everything, and the best-selling of
     * it: two rows that point at the collections page itself, which renders
     * whatever the shop has.
     */
    const menu = code("components/storefront/mega-menu.tsx");
    /*
      Bounded by the next DECLARATION, not by the hook that used to follow
      this one. `useWeddingLinkFilter` went with the Wedding Builder, and an
      `indexOf` that misses returns -1 — which makes the slice empty and the
      "no cake words here" assertion below pass over nothing at all.
    */
    const fallback = menu.slice(
      menu.indexOf("function useFallbackCategories"),
      menu.indexOf("export interface ShopCategory"),
    );
    expect(fallback, "the fallback slice is empty").not.toBe("");

    expect(fallback).not.toMatch(/cake|bakery|eggless|photo-cakes|seasonal|birthday/i);
    expect(fallback, "the generic 'everything' row is gone").toContain("productWordPlural");
  });

  it("hides the occasion column rather than inventing one", () => {
    /**
     * Both menus. A heading over an empty list reads as something that failed
     * to load, and a heading over INVENTED links is worse — it is the shop
     * promising pages it does not have.
     */
    const menu = code("components/storefront/mega-menu.tsx");

    expect(menu.match(/occasions\.length > 0/g) ?? [], "one of the two menus still shows the heading unconditionally").toHaveLength(2);
  });

  it("and the server answers empty rather than demo when it cannot read the catalogue", () => {
    /**
     * The database-unreachable path. Links into a catalogue we cannot read are
     * links to empty grids, so the honest answer is no menu rows at all — the
     * same rule `getStorefrontCollections` follows.
     */
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    const fallback = chrome.slice(
      chrome.indexOf("function fallbackChrome"),
      chrome.indexOf("export const getStorefrontChrome"),
    );

    expect(fallback).toMatch(/categories:\s*\[\]/);
    expect(fallback).toMatch(/occasions:\s*\[\]/);
  });
});

describe("one address is offered once, whichever list it came from", () => {
  /**
   * THE DEFECT THIS FILE'S FIRST VERSION SHIPPED.
   *
   * Categories, occasions and collections share ONE address space:
   * /store/collections/<slug> resolves against all three. This shop's catalogue
   * has a category AND an occasion at `birthday`, at `wedding` and at
   * `anniversary` — so the moment the occasion column started reading real
   * data, the Shop menu offered the same three pages twice, side by side in
   * adjacent columns under two different names.
   *
   * Nothing caught it. React keys are scoped per array and the two columns are
   * two arrays, so there was no warning; the e2e guard literally named "the
   * shop menu links each category once" checked per `<ul>`, and the two columns
   * are two `<ul>`s; and the domain test that shipped with the change asserted
   * only that occasions ARRIVE.
   *
   * A category and an occasion at one slug resolve to the same page. The second
   * row is not another destination — it is the same link with a different word
   * on it.
   */
  const catalog = {
    categories: [
      { id: "1", name: "Birthday Cakes", slug: "birthday" },
      { id: "2", name: "Celebration Cakes", slug: "cakes" },
    ],
    occasions: [
      { id: "oc-1", name: "Birthday", slug: "birthday" },
      { id: "oc-2", name: "Corporate", slug: "corporate" },
      // A second row at one slug, to pin the within-list rule as well.
      { id: "oc-3", name: "Corporate Gifting", slug: "corporate" },
    ],
  };

  async function occasions() {
    vi.resetModules();
    vi.doMock("@/features/catalog/server/catalog.service", () => ({
      getCatalog: async () => catalog,
    }));
    const mod = await import("@/apps/website/lib/storefront-categories.server");
    return mod.getStorefrontOccasions();
  }

  it("drops an occasion whose page a category already offers", async () => {
    const rows = await occasions();

    expect(rows.map((row) => row.slug)).not.toContain("birthday");
  });

  it("and keeps the ones that are a page of their own", async () => {
    const rows = await occasions();

    expect(rows.map((row) => row.slug)).toEqual(["corporate"]);
  });

  it("and still drops a second row at the same slug within its own list", async () => {
    /**
     * The older rule, kept: a second row at one slug is unreachable — the
     * resolver takes the first — so offering it is offering a link that does
     * not go where its label says.
     */
    const rows = await occasions();

    expect(rows.filter((row) => row.slug === "corporate")).toHaveLength(1);
    expect(rows[0]?.name).toBe("Corporate");
  });
});
