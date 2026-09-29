/**
 * A MENU LINK CAN BE A ROW OF THE CATALOGUE, NOT A STRING ABOUT ONE.
 *
 * `HeaderNavItem.menu` has been typed, validated and rendered by both the
 * desktop band and the phone drawer since before this file — and it was empty
 * on every row of every shop. Filling it meant hand-typing a label and a URL
 * per link into a text box, which is tedious enough that nobody did it.
 *
 * The reason it was also WRONG is that nothing in this repository fixes those
 * two strings up afterwards. `updateCategory` merges a patch and writes;
 * `deleteCategories` filters the array and writes; neither tells any consumer.
 * So a typed menu says "Cream Cakes" for ever after the shop renames it, and
 * opens an empty grid after the shop deletes it — the very defect the taxonomy
 * columns were fixed for, arriving through a different door.
 *
 * A picked link stores WHICH ROW it is. The server rebuilds the label and the
 * address from the live catalogue on every render, and drops the link when the
 * row is gone.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { resolveMenuLink, resolveNavMenus, routeForAxis } from "@/features/site-layout/lib/menu-links";
import { offeredAxes } from "@/features/catalog/lib/catalog-utils";
import { drawableGroups } from "@/components/storefront/mega-menu";
import type { HeaderNavItem, MegaMenuLinkItem } from "@/types/site-layout";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/** A comment describing the old shape is not the old shape. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const AXES = {
  category: [{ id: "cat-cream", name: "Cream Cakes", slug: "cream-cakes" }],
  occasion: [{ id: "oc-birthday", name: "Birthday", slug: "birthday" }],
  collection: [{ id: "col-premium", name: "Premium Collection", slug: "premium" }],
};

/** What a link stored a while ago looks like once the shop has renamed the row. */
const STALE_PICK: MegaMenuLinkItem = {
  id: "lnk-1",
  label: "Cream Cakes (old name)",
  href: "/store/collections/old-address",
  ref: { axis: "category", id: "cat-cream" },
};

describe("a picked link follows the row it points at", () => {
  it("takes the LIVE name and address, not the pair that was stored", () => {
    /*
      The stored pair is a record of what was picked, never the source of
      truth. If it were, a rename would have to find and rewrite every menu in
      the header — which is the cascade that does not exist and is why typed
      links go stale.
    */
    const resolved = resolveMenuLink(STALE_PICK, AXES);

    expect(resolved).not.toBeNull();
    expect(resolved!.label).toBe("Cream Cakes");
    expect(resolved!.href).toBe("/store/collections/cream-cakes");
    /* And the pointer survives, or the next render has nothing to resolve. */
    expect(resolved!.ref).toEqual({ axis: "category", id: "cat-cream" });
  });

  it("is DROPPED when its row is gone, and leaves no heading behind", () => {
    /*
      Both halves. A link to a deleted category opens an empty grid, and a
      group emptied of links is a heading over nothing — which reads as
      something that failed to load. `drawableGroups` already answers the
      second, and this pins the chain rather than either end of it.
    */
    const gone: MegaMenuLinkItem = {
      id: "lnk-2",
      label: "Deleted Category",
      href: "/store/collections/deleted",
      ref: { axis: "category", id: "cat-deleted" },
    };

    expect(resolveMenuLink(gone, AXES)).toBeNull();

    const nav: HeaderNavItem[] = [
      {
        id: "nav-cakes",
        label: "Cakes",
        href: "/store/collections",
        isVisible: true,
        sortOrder: 1,
        menu: [{ id: "g1", heading: "By type", sortOrder: 1, isVisible: true, links: [gone] }],
      },
    ];

    const resolved = resolveNavMenus(nav, AXES);
    expect(resolved[0].menu![0].links).toEqual([]);
    expect(drawableGroups(resolved[0].menu), "a heading was left over nothing").toEqual([]);
  });

  it("leaves a link the shop TYPED exactly as it is", () => {
    /*
      CONSTRAINT 10 IN ONE CASE: every link stored in every shop today is this
      shape. A resolver that touched them would rewrite or delete menus nobody
      asked it to touch.
    */
    const typed: MegaMenuLinkItem = {
      id: "lnk-3",
      label: "Corporate orders",
      href: "/store/contact",
      badge: "New",
    };

    expect(resolveMenuLink(typed, AXES)).toEqual(typed);
    expect(
      resolveMenuLink(typed, { category: [], occasion: [], collection: [] }),
      "a typed link was dropped because nothing resolved it",
    ).toEqual(typed);
  });

  it("gives a row with no menu back with NO menu, never an empty one", () => {
    /*
      `absent` means "this row is a plain link" and `[]` means "this row has a
      menu the shop emptied". Collapse the two and every row in every shop
      gains a menu — which the renderer draws INSTEAD of the taxonomy columns
      the Collections row has always shown.
    */
    const plain: HeaderNavItem = {
      id: "nav-home",
      label: "Home",
      href: "/store",
      isVisible: true,
      sortOrder: 1,
    };

    const resolved = resolveNavMenus([plain], AXES);
    expect(resolved[0].menu).toBeUndefined();
    expect("menu" in resolved[0] && resolved[0].menu !== undefined).toBe(false);
  });

  it("sends an occasion to its OWN address", () => {
    /*
      Not hypothetical. This shop shipped a menu where Birthday, Wedding and
      Anniversary opened the CATEGORY of that name, because both expressions
      were spelled at seven separate call sites and one axis was wrong.
    */
    expect(routeForAxis("occasion", "birthday")).toBe("/store/occasions/birthday");
    expect(routeForAxis("occasion", "birthday")).not.toBe("/store/collections/birthday");
    expect(routeForAxis("category", "cream-cakes")).toBe("/store/collections/cream-cakes");
    expect(routeForAxis("collection", "premium")).toBe("/store/collections/premium");
  });
});

describe("what the shop may pick is what the storefront will show", () => {
  it("drops a switched-off row, an empty group and a claimed address", () => {
    /*
      The rule the admin picker and the chrome now share. Three of these four
      lived server-side only, so a screen built on the raw lists could hand the
      shop a link that saves, reads as saved, and never appears on the site.
    */
    const offered = offeredAxes({
      categories: [
        { id: "c1", name: "Live", slug: "live" },
        { id: "c2", name: "Hidden", slug: "hidden", isActive: false },
        { id: "c3", name: "Premium", slug: "premium" },
      ],
      occasions: [{ id: "o1", name: "Birthday", slug: "birthday" }],
      collections: [
        { id: "l1", name: "Premium Picks", slug: "premium", productIds: ["p1"] },
        { id: "l2", name: "Empty Edit", slug: "empty-edit", productIds: [] },
      ],
    });

    expect(offered.categories.map((row) => row.slug)).toEqual(["live"]);
    expect(offered.collections.map((row) => row.slug)).toEqual(["premium"]);
    expect(offered.occasions.map((row) => row.slug)).toEqual(["birthday"]);
  });

  it("is idempotent, so both ends can run it without arguing about who did", () => {
    const input = {
      categories: [{ id: "c1", name: "Live", slug: "live" }],
      occasions: [{ id: "o1", name: "Birthday", slug: "birthday" }],
      collections: [{ id: "l1", name: "Picks", slug: "picks", productIds: ["p1"] }],
    };

    expect(offeredAxes(offeredAxes(input))).toEqual(offeredAxes(input));
  });
});

describe("the server resolves against the very lists it publishes", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock("@/features/settings/server/settings.service");
    vi.doUnmock("@/features/site-layout/server/site-layout.service");
    vi.doUnmock("@/apps/website/lib/storefront-categories.server");
    vi.resetModules();
  });

  /**
   * The header document, and ONLY for the header key.
   *
   * `async () => ({})` for every key feeds the same object to the footer merge
   * and to `appearanceCssVariables`, which sends the chrome down its catch
   * into `fallbackChrome()` — and then this case fails for a reason that has
   * nothing to do with the resolver.
   */
  function mockChrome(nav: HeaderNavItem[], catalog: Record<string, unknown>) {
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => ({ general: {}, contact: {}, social: [] }),
    }));
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async (key: string) => (key === "header" ? { nav } : {}),
    }));
    vi.doMock("@/apps/website/lib/storefront-categories.server", () => catalog);
  }

  const ROW = (menuLink: MegaMenuLinkItem): HeaderNavItem => ({
    id: "nav-cakes",
    label: "Cakes",
    href: "/store/collections",
    isVisible: true,
    sortOrder: 1,
    menu: [{ id: "g1", heading: "By type", sortOrder: 1, isVisible: true, links: [menuLink] }],
  });

  it("does not offer a category whose address a collection has taken", async () => {
    /*
      THE WIRING, and no unit test on the pure resolver can reach it. Feed the
      resolver the raw lists instead of the offered ones and this link comes
      back alive — a row labelled "Premium" opening the COLLECTION's page,
      because that is how the route resolves.
    */
    mockChrome([ROW({ id: "l1", label: "Premium", href: "/x", ref: { axis: "category", id: "cat-premium" } })], {
      getStorefrontCategories: async () => [{ id: "cat-premium", name: "Premium", slug: "premium" }],
      getStorefrontOccasions: async () => [],
      getStorefrontCollections: async () => [
        { id: "col-premium", name: "Premium Picks", slug: "premium", productIds: ["p1"] },
      ],
    });

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    expect(chrome.navItems[0].menu![0].links, "the link survived a claimed slug").toEqual([]);
    expect(chrome.categories).toEqual([]);
  });

  it("does not offer a group the shop emptied", async () => {
    mockChrome([ROW({ id: "l2", label: "Edit", href: "/x", ref: { axis: "collection", id: "col-empty" } })], {
      getStorefrontCategories: async () => [],
      getStorefrontOccasions: async () => [],
      getStorefrontCollections: async () => [
        { id: "col-empty", name: "Empty Edit", slug: "empty-edit", productIds: [] },
      ],
    });

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    expect(chrome.navItems[0].menu![0].links).toEqual([]);
  });

  it("rebuilds a picked link's words from the live row", async () => {
    mockChrome(
      [
        ROW({
        id: "l3",
        label: "the name it had last year",
        href: "/store/collections/whatever",
        ref: { axis: "occasion", id: "oc-birthday" },
        }),
      ],
      {
        getStorefrontCategories: async () => [],
        getStorefrontOccasions: async () => [{ id: "oc-birthday", name: "Birthday", slug: "birthday" }],
        getStorefrontCollections: async () => [],
      },
    );

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    expect(chrome.navItems[0].menu![0].links).toEqual([
      {
        id: "l3",
        label: "Birthday",
        href: "/store/occasions/birthday",
        ref: { axis: "occasion", id: "oc-birthday" },
      },
    ]);
  });
});

describe("a column the shop did not name", () => {
  // Without it React warns on every `act`, and the warning drowns a real one.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = null;
    container = null;
  });

  const GROUPS = [
    {
      id: "g1",
      heading: "",
      sortOrder: 1,
      isVisible: true,
      links: [{ id: "l1", label: "Cream Cakes", href: "/store/collections/cream-cakes" }],
    },
  ];

  async function mount(Component: unknown, props: Record<string, unknown>) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement(Component as never, props as never));
    });
    return container;
  }

  it("is drawn with no heading at all, on the desktop", async () => {
    /*
      A new group's heading box arrives EMPTY now — this software may not write
      a column name on the shop's behalf, and "New group" appearing in a live
      panel is exactly that. Unconditional, the blank renders an empty
      paragraph and its margin: a heading-shaped gap above the links.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");
    const el = await mount(MegaMenu, { isActive: false, groups: GROUPS });

    const panel = el.querySelector("[data-mega-panel]");
    expect(panel, "no panel rendered").not.toBeNull();
    expect(panel!.querySelectorAll("p").length, "a blank heading still draws a paragraph").toBe(0);
    expect(panel!.querySelectorAll("a[href]").length, "the links went with it").toBe(1);
  });

  it("and with no heading on the phone either", async () => {
    /*
      BOTH RENDERERS. A fix that lands on one of the two is a defect this
      component has shipped twice. The phone keeps the ROW's own label, so the
      right answer here is exactly one paragraph, not zero.
    */
    const { MobileShopLinks } = await import("@/components/storefront/mega-menu");
    const el = await mount(MobileShopLinks, { label: "Cakes", groups: GROUPS });

    expect(el.querySelectorAll("p").length, "the group's blank heading drew a paragraph").toBe(1);
    expect(el.querySelectorAll("a[href]").length).toBe(1);
  });
});

describe("the screen where a shop picks one", () => {
  const admin = code("apps/admin/header/components/header-admin-page.tsx");

  it("writes a pointer, not just a label and a URL", () => {
    /*
      Without the `ref` the picker is a URL typist with extra steps: the link
      it adds goes stale exactly like a hand-typed one, and every claim made
      for picking is false.
    */
    const at = admin.indexOf("function addPickedLinks");
    expect(at, "the picker has no writer").toBeGreaterThan(-1);
    const writer = admin.slice(at, admin.indexOf("function unlinkFromCatalog"));

    expect(writer, "the picker stores no pointer").toContain("ref: { axis: ref.axis, id: ref.id }");
    expect(writer, "the picker types its own address").toContain("routeForAxis(ref.axis, row.slug)");
  });

  it("offers only what the storefront will keep", () => {
    /*
      The picker must ask the SAME question the server asks. Four filters that
      live server-side only are four ways for this screen to offer a row the
      chrome then drops — a link that looks saved and never appears.
    */
    expect(admin, "the picker reads the raw lists").toContain("offeredAxes({");
    const dialog = admin.slice(admin.indexOf("Pick from catalog"));
    expect(dialog).toContain("offered.categories");
    expect(dialog).toContain("offered.occasions");
    expect(dialog).toContain("offered.collections");
  });

  it("cannot be pressed against the shipped demo taxonomy", () => {
    /*
      This is a `"use client"` page rendered on the server first, where
      `loadCatalogStore` answers `defaultCatalogStore`. A tick in the first few
      hundred milliseconds stores the id of a row this shop does not have, and
      the link is dropped at render with the admin still showing it saved.
    */
    const at = admin.indexOf("setPickTarget({ navId");
    expect(at, "the picker has no button").toBeGreaterThan(-1);
    const button = admin.slice(Math.max(0, at - 400), at);
    expect(button, "the picker can be pressed before the catalogue arrives").toContain(
      "disabled={!catalogReady}",
    );
    expect(admin, "readiness is assumed rather than asked").toContain(
      'catalogHydrationStatus() === "ready"',
    );
  });

  it("heads its lists in the shop's own nouns", () => {
    const dialog = admin.slice(admin.indexOf("Pick from catalog"));
    expect(dialog).toContain("labels.categoryWordPlural");
    expect(dialog).toContain("labels.occasionWordPlural");
    expect(dialog).toContain("labels.collectionWordPlural");
  });

  it("does not name a new column on the shop's behalf", () => {
    const at = admin.indexOf("function addGroup");
    const body = admin.slice(at, admin.indexOf("function patchGroup"));
    expect(body, "a new group arrives pre-named").not.toContain('heading: "New group"');
    expect(body).toContain('heading: ""');
  });
});

describe("the header still reaches no product", () => {
  it("not through the resolver either", () => {
    /*
      The line this whole design holds. Beside the chrome's own guard: the
      resolver is the obvious place for "and show how many are in each", and
      a count needs the product collection on every route in the site.
    */
    const resolver = code("features/site-layout/lib/menu-links.ts");

    expect(resolver).not.toMatch(/getStorefrontProductCards|products-service|products\.service/);
    expect(resolver).not.toContain("listAll");
  });
});

describe("a pointer nobody typed by hand", () => {
  it("is refused when its axis is not one of the three", async () => {
    /*
      THE LOAD-BEARING HALF.

      The object around this field is `.passthrough()` over a Mongoose `Mixed`
      column, so a round-trip test would pass with the field UNDECLARED —
      passthrough stores whatever it is handed. What declaring it buys is the
      refusal, and this endpoint takes a hand-editable file through backup
      restore. Stored, `axis: "brand"` resolves to nothing and the link
      silently disappears from the site with the admin still showing it saved.
    */
    const { headerSchema } = await import(
      "@/features/site-layout/server/site-layout.validators"
    );

    const withAxis = (axis: string) => ({
      logoLetter: "S",
      showSearch: true,
      showCta: false,
      ctaLabel: "",
      ctaHref: "",
      nav: [
        {
          id: "nav-1",
          label: "Cakes",
          href: "/store/collections",
          isVisible: true,
          sortOrder: 1,
          menu: [
            {
              id: "g1",
              heading: "",
              sortOrder: 1,
              isVisible: true,
              links: [{ id: "l1", label: "X", href: "/x", ref: { axis, id: "cat-1" } }],
            },
          ],
        },
      ],
    });

    expect(headerSchema.safeParse(withAxis("category")).success).toBe(true);
    expect(
      headerSchema.safeParse(withAxis("brand")).success,
      "an axis nothing can resolve was stored",
    ).toBe(false);
  });
});
