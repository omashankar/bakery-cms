/**
 * ONE ALPHABET IS NOT A MENU.
 *
 * A shop selling cakes and flowers and gifts keeps ONE category list, and the
 * header drew it flat: Anniversary, Bouquets, Chocolate, Cupcakes, Roses. A
 * customer could not see where one kind of thing stopped and the next started,
 * and the reference header this is modelled on cuts exactly there.
 *
 * So the category column is SECTIONED by the shop's own departments — as
 * sub-headings inside that column, not as a fourth column, which is why no
 * panel width moves with this.
 *
 * THE TWO THINGS THAT MADE THIS RISKY, and what this file pins about each:
 *
 *   - EVERY SHOP HAS ZERO DEPARTMENTS TODAY, this one included. So the
 *     no-department answer is the one that must not move: one unheaded section
 *     holding everything, drawing the same list of links in the same order.
 *
 *   - WHICH DEPARTMENT HOLDS A CATEGORY is asked of `departmentFor`, and TWO
 *     SURFACES ASK IT: this menu, and the trail above a product, which gets
 *     its `departmentCrumb` from the same function in
 *     `app/(storefront)/store/p/[slug]/page.tsx`. Decided twice, the menu
 *     could file Roses under Flowers while the trail said Gifts — each looking
 *     right in its own file. That is the shape of nearly every defect this
 *     menu has had.
 *
 *     So the case below pins the menu against the RULE rather than against the
 *     trail's output: one assertion over a shared function is what keeps the
 *     two from drifting, and a test that read the other screen's answer would
 *     pass with both of them wrong together.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { categorySections, departmentFor } from "@/features/catalog/lib/catalog-utils";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/* The shop in these cases sells three kinds of thing. None of it is bakery. */
const cake = { id: "c-cup", name: "Cupcakes", slug: "cupcakes" };
const choc = { id: "c-choc", name: "Chocolate", slug: "chocolate" };
const rose = { id: "c-rose", name: "Roses", slug: "roses" };
const mug = { id: "c-mug", name: "Mugs", slug: "mugs" };
const ALL = [cake, choc, rose, mug];

const CAKES = {
  id: "d-cake",
  name: "Cakes",
  slug: "cakes",
  sortOrder: 0,
  categoryIds: [cake.id, choc.id],
};
const FLOWERS = { id: "d-flo", name: "Flowers", slug: "flowers", sortOrder: 1, categoryIds: [rose.id] };

/* The nouns a panel heads its columns with, for the render cases below. */
const WORDS_FOR_SHAPE = {
  productWordPlural: "Products",
  categoryWord: "Category",
  occasionWord: "Occasion",
  collectionWord: "Collection",
};

const headings = (sections: { heading: string }[]) => sections.map((s) => s.heading);
const named = (sections: { categories: { name: string }[] }[]) =>
  sections.map((s) => s.categories.map((c) => c.name));

describe("the category list, cut into the kinds of thing", () => {
  it("is ONE UNHEADED SECTION when the shop keeps no departments", () => {
    /*
      THE CASE EVERY SHOP IS IN. Both spellings of "none" — absent and empty —
      because the chrome sends `[]` on the database-unreachable path and the
      component's prop is optional.
    */
    for (const none of [undefined, []]) {
      const sections = categorySections(ALL, none);
      expect(headings(sections)).toEqual([""]);
      expect(named(sections)).toEqual([["Cupcakes", "Chocolate", "Roses", "Mugs"]]);
    }
  });

  it("and still is, when departments exist but hold nothing yet", () => {
    /*
      A shop that has created the row and not filed anything under it. A page
      of empty headings is worse than the flat list, and a shop cannot see the
      difference between that and something that failed to load.
    */
    const empty = { ...CAKES, categoryIds: [] };
    const sections = categorySections(ALL, [empty]);
    expect(headings(sections)).toEqual([""]);
    expect(named(sections)).toEqual([["Cupcakes", "Chocolate", "Roses", "Mugs"]]);
  });

  it("puts each category under its department, in the shop's own order", () => {
    const sections = categorySections(ALL, [FLOWERS, CAKES]);
    /*
      FLOWERS is passed first and `sortOrder` puts it second — the order is the
      one the shop set on its Departments tab, not the order this array happens
      to be in. Re-ordering that tab is the only control over this a shop
      should need.
    */
    expect(headings(sections)).toEqual(["Cakes", "Flowers", ""]);
    expect(named(sections)).toEqual([["Cupcakes", "Chocolate"], ["Roses"], ["Mugs"]]);
  });

  it("keeps what nothing claims, LAST and unheaded", () => {
    /*
      NOT DROPPED. A shop half way through filing its catalogue would otherwise
      watch its own categories disappear from its own menu as it created the
      first department — and it would have no way to tell that from a bug.
    */
    const sections = categorySections(ALL, [CAKES]);
    /*
      THE WHOLE OBJECT, not just its categories — which is what caught `id`
      being added to the shape. The leftover section has no department, so its
      id is empty and the renderers fall back to the index for a key.
    */
    expect(sections.at(-1)).toEqual({ id: "", heading: "", categories: [rose, mug] });
  });

  it("files a category claimed twice ONCE, and where the shared rule says", () => {
    /*
      THE AGREEMENT THAT MATTERS. Two departments both claim Roses, and the
      menu must file it where `departmentFor` says — because the trail above a
      product will be asked the same question next, and if the two can differ
      the shop describes itself two ways at once.
    */
    const alsoRose = { ...CAKES, categoryIds: [...CAKES.categoryIds, rose.id] };
    const sections = categorySections(ALL, [alsoRose, FLOWERS]);

    const holder = sections.find((s) => s.categories.some((c) => c.id === rose.id));
    expect(holder?.heading).toBe(departmentFor([alsoRose, FLOWERS], rose.id)?.name);
    expect(holder?.heading).toBe("Cakes");

    const times = sections.flatMap((s) => s.categories).filter((c) => c.id === rose.id).length;
    expect(times, "the same category was offered under two headings").toBe(1);
  });

  it("keeps two departments with the SAME NAME apart", () => {
    /*
      THE DEFECT THIS FUNCTION SHIPPED WITH, and the reason the bucket is keyed
      by id. Keyed by `name`, two departments called "Gifts" shared one bucket
      and then both read the whole of it back — measured on the shipped code:

        [{"h":"Gifts","c":["Roses","Mugs"]},{"h":"Gifts","c":["Roses","Mugs"]}]
        each category appears: {"Roses":2,"Mugs":2}

      REACHABLE, not theoretical. The admin's only uniqueness check is
      `findSlugClash`, which is about the SLUG — nothing anywhere constrains a
      department's name, and backup restore posts a hand-editable document to
      that endpoint. A shop with a typo-duplicate, or one restoring a backup,
      saw its whole category list twice under one heading twice.
    */
    const left = { ...CAKES, id: "d-one", name: "Gifts", slug: "gifts", categoryIds: [cake.id] };
    const right = { ...CAKES, id: "d-two", name: "Gifts", slug: "gifts-2", categoryIds: [rose.id] };
    const sections = categorySections(ALL, [left, right]);

    expect(headings(sections)).toEqual(["Gifts", "Gifts", ""]);
    expect(named(sections)).toEqual([["Cupcakes"], ["Roses"], ["Chocolate", "Mugs"]]);

    const flat = sections.flatMap((s) => s.categories);
    for (const category of ALL) {
      const times = flat.filter((c) => c.id === category.id).length;
      expect(times, `${category.name} is offered ${times} times`).toBe(1);
    }

    /*
      AND THE SECTION CARRIES SOMETHING UNIQUE TO KEY ON. On the heading, those
      two sections both keyed "Gifts".
    */
    const keys = sections.map((section, index) => section.id || `unfiled-${index}`);
    expect(new Set(keys).size, `the sections share a key: ${JSON.stringify(keys)}`).toBe(
      keys.length,
    );
  });

  it("and both renderers key on it, which only the source can show", () => {
    /*
      THIS ONE IS A SOURCE CHECK ON PURPOSE, and it is worth saying why rather
      than implying a behavioural guard exists.

      A colliding React key does NOT change a first mount: measured — two
      departments both named "Gifts" keyed on the heading still rendered
      "Roses" and "Mugs" once each with both headings present. React warns and
      draws both; what it breaks is RECONCILIATION, when a later render reuses
      the wrong subtree. No single mount reddens that, and the mutation proved
      it: keying on the heading again left the fourteen cases above green.

      So the key is pinned where it can be seen. Both renderers, counted —
      this component has shipped a fix on the desktop and not the phone before,
      and the phone is the screen this shop's customers use.
    */
    const menu = code("components/storefront/mega-menu.tsx");
    expect(
      menu.match(/key=\{section\.id \|\| `unfiled-\$\{index\}`\}/g) ?? [],
      "a renderer keys its sections on something that can repeat",
    ).toHaveLength(2);
    expect(menu, "a renderer still keys on the heading").not.toMatch(/key=\{section\.heading/);
  });

  it("and a switched-off department files nothing", () => {
    /*
      Through `offeredRows`, so this answer cannot drift from what the rest of
      the storefront is willing to show.
    */
    const sections = categorySections(ALL, [{ ...CAKES, isActive: false }, FLOWERS]);
    expect(headings(sections)).toEqual(["Flowers", ""]);
    expect(named(sections)).toEqual([["Roses"], ["Cupcakes", "Chocolate", "Mugs"]]);
  });
});

describe("what the server sends and what the header does with it", () => {
  it("the chrome carries the list, and BOTH menus are given it", () => {
    /*
      COUNTED AT TWO. This component has shipped an occasion column on the
      desktop and none on the phone — the phone being the screen this shop's
      customers actually use. One call site wired and not the other is that
      defect again.
    */
    const navbar = code("apps/website/components/storefront-navbar.tsx");
    expect(navbar.match(/departments=\{chrome\.departments\}/g) ?? []).toHaveLength(2);

    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome, "the list is never read").toContain("getStorefrontDepartments()");
    expect(chrome, "the read is not in the one round trip the others share").toMatch(
      /getStorefrontCollections\(\),[\s\S]{0,200}getStorefrontDepartments\(\)/,
    );
    expect(chrome, "the shared rule never sees the fourth list").toMatch(
      /offeredAxes\(\{[\s\S]{0,200}departments: departmentRows/,
    );
  });

  it("and the stored row does NOT cross the RSC wire whole", async () => {
    /*
      RUN, NOT GREPPED — and this one is not hypothetical.

      The first version of this was `not.toMatch(/departments:
      offered\.departments,/)`, which names ONE spelling of the mistake. While
      this change was being reviewed, an agent replaced the projection with
      `departments: [...offered.departments]` and left it in the working tree.
      The whole stored row was crossing the wire and the guard was green; it
      was caught by reading `git diff`, which is not a test.

      The object reaches a CLIENT navbar on every storefront and /account
      route, cart and checkout among them. `description` and `image` are
      drawn by nothing there, and one shop's department images are the kind of
      payload that turns up as a slow checkout months later.
    */
    vi.resetModules();
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => ({ general: {}, contact: {}, social: [] }),
    }));
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async () => ({}),
    }));
    vi.doMock("@/apps/website/lib/storefront-categories.server", () => ({
      getStorefrontCategories: async () => [{ id: "c1", name: "Roses", slug: "roses" }],
      getStorefrontOccasions: async () => [],
      getStorefrontCollections: async () => [],
      getStorefrontDepartments: async () => [
        {
          id: "d1",
          name: "Flowers",
          slug: "flowers",
          sortOrder: 0,
          categoryIds: ["c1"],
          /* The two fields the wire must not carry. */
          description: "a paragraph the navbar draws nowhere",
          image: "/uploads/a-photograph-the-navbar-draws-nowhere.jpg",
        },
      ],
    }));

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    expect(chrome.departments).toHaveLength(1);
    /*
      THE WHOLE KEY SET, not two `toBeUndefined`s. A spread carries whatever
      the stored row happens to hold, so naming the fields to exclude is the
      same enumeration problem the regex had — this names what is ALLOWED.
    */
    expect(Object.keys(chrome.departments[0]).sort()).toEqual([
      "categoryIds",
      "id",
      "name",
      "slug",
      "sortOrder",
    ]);
    expect(chrome.departments[0]).toEqual({
      id: "d1",
      name: "Flowers",
      slug: "flowers",
      sortOrder: 0,
      categoryIds: ["c1"],
    });

    vi.doUnmock("@/features/settings/server/settings.service");
    vi.doUnmock("@/features/site-layout/server/site-layout.service");
    vi.doUnmock("@/apps/website/lib/storefront-categories.server");
    vi.resetModules();
  });

  it("and BOTH renderers ask the shared rule, neither spelling it again", () => {
    const menu = code("components/storefront/mega-menu.tsx");
    expect(menu.match(/categorySections\(shopCategories, shopDepartments\)/g) ?? []).toHaveLength(2);
    expect(menu.match(/categorySets\.map\(/g) ?? []).toHaveLength(2);
    /*
      And the flat list is gone from both. Left in one, the fix reaches one
      screen — which is how the occasion column came to exist on the desktop
      only.
    */
    expect(menu, "a renderer still draws the flat list").not.toContain("{categories.map(");
    expect(menu, "the filing rule is written out beside the shared one").not.toMatch(
      /categoryIds[\s\S]{0,30}\.includes\(/,
    );
  });
});

describe("the panel does not change shape for this", () => {
  it("draws the same panel with departments as without", async () => {
    /*
      THE WHOLE REASON THIS IS SUB-HEADINGS. A fourth column needs a panel
      wider than 40rem, and a wider panel cannot hang off a nav row and stay on
      screen — measured: at 1024px a row starting at 396px has no edge that
      fits even a 640px panel. Departments were made to fit the panel there is.

      MEASURED FROM THE RENDER, because the source check here could not fail.
      It was `expect(menu.slice(at, at + 200)).not.toContain("departments")`
      over the window around `taxonomyColumns` — and in that window the list is
      spelled `shopDepartments`, which does not contain the lower-case string
      it looked for. A `taxonomyColumns` that counted departments would have
      passed it. The companion regex was worse: `PANEL_WIDTH` is keyed by rem,
      so `4: "w-[min(` names a key that could never exist.

      So the panel's own class list is compared, with departments and without.
      That covers the width map, the column count and the card together, and it
      cannot be satisfied by how anything is spelled.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");

    const panelClassFor = async (props: Record<string, unknown>) => {
      const host = document.createElement("div");
      document.body.append(host);
      const root = createRoot(host);
      await act(async () => {
        root.render(createElement(MegaMenu as never, props as never));
      });
      const panel = host.querySelector("[data-mega-panel]");
      const className = panel?.className ?? "";
      act(() => root.unmount());
      host.remove();
      return className;
    };

    const base = { categories: ALL, words: WORDS_FOR_SHAPE, label: "Shop" };
    const without = await panelClassFor(base);
    const with1 = await panelClassFor({ ...base, departments: [CAKES] });
    const with2 = await panelClassFor({ ...base, departments: [CAKES, FLOWERS] });

    expect(without, "no panel rendered to compare").toContain("absolute");
    expect(with1, "one department changed the panel's shape").toBe(without);
    expect(with2, "two departments changed the panel's shape").toBe(without);
  });
});

describe("what a customer actually sees", () => {
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

  async function mount(Component: unknown, props: Record<string, unknown>) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement(Component as never, props as never));
    });
    return container;
  }

  const WORDS = {
    productWordPlural: "Products",
    categoryWord: "Category",
    occasionWord: "Occasion",
    collectionWord: "Collection",
  };
  const PROPS = { categories: ALL, words: WORDS, label: "Shop" };

  /* Every heading the panel draws, in the order it draws them. */
  const drawnHeadings = (el: HTMLElement) =>
    [...el.querySelectorAll("p")].map((p) => p.textContent?.trim() ?? "");

  for (const which of ["MegaMenu", "MobileShopLinks"] as const) {
    it(`${which} draws the sub-headings, each category once`, async () => {
      const mod = await import("@/components/storefront/mega-menu");
      const el = await mount(mod[which], { ...PROPS, departments: [CAKES, FLOWERS] });

      const shown = drawnHeadings(el);
      expect(shown, "the department is not a heading anywhere in the panel").toContain("Cakes");
      expect(shown).toContain("Flowers");
      /* Under the column's own heading, not instead of it. */
      expect(shown.indexOf("Shop by Category")).toBeLessThan(shown.indexOf("Cakes"));

      for (const category of ALL) {
        const links = el.querySelectorAll(`a[href="/store/collections/${category.slug}"]`);
        expect(links.length, `${category.name} appears ${links.length} times`).toBe(1);
      }
      /* And Mugs, which nothing claims, is still reachable. */
      expect(el.querySelector('a[href="/store/collections/mugs"]')).not.toBeNull();
    });

    it(`${which} draws no sub-heading when the shop has no departments`, async () => {
      /*
        THE ANSWER THAT MUST NOT MOVE. An empty heading element would be a
        blank line above the list on every shop's header today.
      */
      const mod = await import("@/components/storefront/mega-menu");
      const el = await mount(mod[which], PROPS);

      expect(drawnHeadings(el).filter((text) => text === "")).toHaveLength(0);
      for (const category of ALL) {
        expect(
          el.querySelectorAll(`a[href="/store/collections/${category.slug}"]`).length,
          `${category.name} is not in the flat list exactly once`,
        ).toBe(1);
      }
    });
  }
});
