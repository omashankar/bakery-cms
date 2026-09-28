/**
 * THE MENU CARRIES ALL THREE AXES, AND HEADS THEM IN THE SHOP'S OWN WORDS.
 *
 * The catalogue separated three concepts — what a thing IS (category), what it
 * is FOR (occasion), and which group somebody deliberately PUT it in
 * (collection) — each with its own address, status and sort order. The header
 * carried two of them. So the one axis a shop assembles by hand was the one
 * its menu could not show: this shop's two collections hold seven products
 * between them and there was no way into either from the nav.
 *
 * And the two columns it did carry were headed in hardcoded English, in a CMS
 * whose admin has carried `categoryWord`, `occasionWord` and `collectionWord`
 * for a while now. A shop filing under Brands read Brands in its admin and
 * "Shop by Category" on its own site.
 *
 * These cases are about the rule rather than this shop's data: three axes,
 * both screens, the shop's nouns, and nothing offered that opens an empty
 * grid.
 */
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
/** A comment describing the old shape is not the old shape. */
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

describe("the third axis travels from the server to both menus", () => {
  it("is read in the SAME round trip as the other two", () => {
    /*
      Not a fresh `await`. The categories read was once a serial await below
      this block and put a whole extra round trip on the critical path of
      every storefront render — cart and checkout included. `getCatalog` is
      `cache()`d, so three concurrent callers are ONE document read; a serial
      await would be three sequential ones for the same document.
    */
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    const all = chrome.slice(chrome.indexOf("Promise.all(["), chrome.indexOf("]);"));

    expect(all, "the Promise.all slice is empty").not.toBe("");
    expect(all).toContain("getStorefrontCollections()");
  });

  it("reaches BOTH call sites in the navbar, not just the desktop one", () => {
    /*
      The phone is the one an Indian shop's customers actually use, and this
      component shipped with no occasion column at all once already. Two, the
      same count the occasions line next door is pinned at.
    */
    const navbar = code("apps/website/components/storefront-navbar.tsx");

    expect(navbar.match(/collections=\{chrome\.collections\}/g) ?? []).toHaveLength(2);
    expect(navbar.match(/words=\{chrome\.menuWords\}/g) ?? []).toHaveLength(2);
  });

  it("is hidden rather than headed empty, on both screens", () => {
    // A heading over an empty list reads as something that failed to load.
    const menu = code("components/storefront/mega-menu.tsx");

    expect(
      menu.match(/collections\.length > 0/g) ?? [],
      "one of the two menus draws the heading unconditionally",
    ).toHaveLength(2);
  });

  it("answers empty rather than demo when the catalogue cannot be read", () => {
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    const fallback = chrome.slice(
      chrome.indexOf("function fallbackChrome"),
      chrome.indexOf("export const getStorefrontChrome"),
    );

    expect(fallback, "the fallback slice is empty").not.toBe("");
    expect(fallback).toMatch(/collections:\s*\[\]/);
  });

  it("never reaches the product collection to build a header", () => {
    /*
      THE LINE THIS WHOLE DESIGN EXISTS TO HOLD.

      The header renders on every storefront and /account route — cart and
      checkout among them — and those routes do not read products today. A
      column driven by anything derived from product rows (option groups,
      per-category counts, "top trending") means `listAll()`, an unfiltered
      find over the whole products collection, in the layout, on all of them.
      There is no `unstable_cache` and no `revalidateTag` anywhere in source
      to soften it.

      Crude on purpose: this is the exact import a future "just count the
      products per category" change would add.
    */
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");

    expect(chrome).not.toContain("getStorefrontProductCards");
    expect(chrome).not.toContain("products.service");
    expect(chrome).not.toContain("products-service");
  });
});

describe("the server decides which groups are offered at all", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.doUnmock("@/features/settings/server/settings.service");
    vi.doUnmock("@/features/site-layout/server/site-layout.service");
    vi.doUnmock("@/apps/website/lib/storefront-categories.server");
    vi.resetModules();
  });

  /** The settings and layout reads this test is not about. */
  function mockTheRest() {
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => ({ general: {}, contact: {}, social: [] }),
    }));
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async () => ({}),
    }));
  }

  it("drops a group with nothing in it", async () => {
    /*
      A link to an empty grid is the defect the hardcoded menu had, in a new
      place. Answered from `productIds.length` — no product read.
    */
    mockTheRest();
    vi.doMock("@/apps/website/lib/storefront-categories.server", () => ({
      getStorefrontCategories: async () => [],
      getStorefrontOccasions: async () => [],
      getStorefrontCollections: async () => [
        { id: "c1", name: "Empty Edit", slug: "empty-edit", productIds: [] },
        { id: "c2", name: "Gift Hampers", slug: "gift-hampers", productIds: ["p1", "p2"] },
      ],
    }));

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    expect(chrome.collections.map((row) => row.slug)).toEqual(["gift-hampers"]);
  });

  it("carries the name and the slug and NOT the member ids", async () => {
    /*
      This object crosses the RSC wire into a client navbar on every route.
      `getStorefrontCollections` returns each row whole — description, image
      and every member id — so one 500-product group would be 500 ids in the
      checkout payload, to render a name.
    */
    mockTheRest();
    vi.doMock("@/apps/website/lib/storefront-categories.server", () => ({
      getStorefrontCategories: async () => [],
      getStorefrontOccasions: async () => [],
      getStorefrontCollections: async () => [
        {
          id: "c2",
          name: "Gift Hampers",
          slug: "gift-hampers",
          description: "a paragraph nobody in the header reads",
          image: "https://example.test/x.jpg",
          productIds: ["p1", "p2"],
        },
      ],
    }));

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    expect(chrome.collections).toEqual([
      { id: "c2", name: "Gift Hampers", slug: "gift-hampers" },
    ]);
  });

  it("does not offer a category whose address a collection has taken", async () => {
    /*
      Both render at /store/collections/<slug> and the route resolves
      COLLECTION first — collections/[slug]/page.tsx does it in the page and
      repeats it in `generateMetadata`, so the title and the grid cannot
      describe different things. Two rows at one address means the category's
      row opens somebody else's page under the category's name.

      `offeredRows` dedupes WITHIN one list. Nothing deduped ACROSS two,
      because until now only one of the two was in the header at all.
    */
    mockTheRest();
    vi.doMock("@/apps/website/lib/storefront-categories.server", () => ({
      getStorefrontCategories: async () => [
        { id: "cat1", name: "Premium", slug: "premium" },
        { id: "cat2", name: "Cupcakes", slug: "cupcakes" },
      ],
      getStorefrontOccasions: async () => [],
      getStorefrontCollections: async () => [
        { id: "col1", name: "Premium Picks", slug: "premium", productIds: ["p1"] },
      ],
    }));

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    // The collection keeps the address, matching the route's own order.
    expect(chrome.collections.map((row) => row.slug)).toEqual(["premium"]);
    expect(
      chrome.categories.map((row) => row.slug),
      "the category still offers a link that opens the collection's page",
    ).toEqual(["cupcakes"]);
  });
});

describe("the panel the customer actually sees", () => {
  // Without it React warns on every `act`, and the warning drowns a real one.
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

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

  const CATEGORIES = [
    { id: "cat1", name: "Chocolate Cakes", slug: "chocolate-cakes" },
    { id: "cat2", name: "Cupcakes", slug: "cupcakes" },
  ];
  const OCCASIONS = [{ id: "occ1", name: "Anniversary", slug: "anniversary" }];
  const COLLECTIONS = [
    { id: "col1", name: "Gift Hampers", slug: "gift-hampers" },
    { id: "col2", name: "Under 500", slug: "under-500" },
  ];
  /** Nouns no trade preset ships, so a default leaking through is obvious. */
  const WORDS = {
    productWordPlural: "Things",
    categoryWord: "Brand",
    occasionWord: "Festival",
    collectionWord: "Edit",
  };

  async function mount(Component: unknown, props: Record<string, unknown>) {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(createElement(Component as never, props as never));
    });
    return container;
  }

  it("heads every column in the shop's own noun, on the desktop", async () => {
    /*
      A RENDER check and not a `not.toContain` over the file: a file-scoped
      string assertion passes the moment any comment or sibling mentions the
      word, which is the species of green-for-the-wrong-reason this project
      has already been burned by.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");
    const el = await mount(MegaMenu, {
      isActive: false,
      categories: CATEGORIES,
      occasions: OCCASIONS,
      collections: COLLECTIONS,
      words: WORDS,
    });

    const text = el.innerText || el.textContent || "";
    expect(text).toContain("Shop by Brand");
    expect(text).toContain("Shop by Festival");
    expect(text).toContain("Shop by Edit");
    expect(text, "an English default is still typed into the panel").not.toMatch(
      /Shop by (Category|Occasion|Collection)/,
    );
  });

  it("and on the phone, which is the screen that gets used", async () => {
    const { MobileShopLinks } = await import("@/components/storefront/mega-menu");
    const el = await mount(MobileShopLinks, {
      categories: CATEGORIES,
      occasions: OCCASIONS,
      collections: COLLECTIONS,
      words: WORDS,
    });

    const text = el.innerText || el.textContent || "";
    expect(text).toContain("Shop by Brand");
    expect(text).toContain("Shop by Festival");
    expect(text).toContain("Shop by Edit");
    expect(text, "an English default is still typed into the phone menu").not.toMatch(
      /Shop by (Category|Occasion|Collection)/,
    );
  });

  it("opens the same set of pages on both screens", async () => {
    /*
      THE GUARD THIS REPO HAS BEEN BURNED BY TWICE — the phone menu shipped
      with no occasion column while the desktop had one, and nothing went
      red. Counting call sites does not catch a section deleted from one of
      the two components; comparing the hrefs they actually render does.
    */
    const { MegaMenu, MobileShopLinks } = await import("@/components/storefront/mega-menu");
    const props = {
      categories: CATEGORIES,
      occasions: OCCASIONS,
      collections: COLLECTIONS,
      words: WORDS,
    };

    /*
      SCOPED TO THE PANEL. `MegaMenu` also renders the nav ROW itself — the
      trigger link, whose destination is the row's own page and which the
      phone draws elsewhere in the navbar. Comparing whole components would
      pin that difference as a defect; the subject here is the three lists.
    */
    const desktop = await mount(MegaMenu, { ...props, isActive: false });
    const panel = desktop.querySelector("[data-mega-panel]");
    expect(panel, "no panel rendered to compare").not.toBeNull();
    const desktopHrefs = new Set(
      [...panel!.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!),
    );
    act(() => root!.unmount());
    container!.remove();

    const phone = await mount(MobileShopLinks, props);
    const phoneHrefs = new Set(
      [...phone.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")!),
    );

    expect([...phoneHrefs].sort()).toEqual([...desktopHrefs].sort());
    // And the third axis really is among them, or the two could agree on nothing.
    expect(phoneHrefs.has("/store/collections/gift-hampers")).toBe(true);
  });

  it("asks the grid map for a key that exists, at every column count", async () => {
    /*
      The width and the track count come from two different places:
      `panelShape` returns a number and `TAXONOMY_GRID` returns a class. Miss
      a key and `cn` drops the `undefined`, the panel collapses to ONE
      implicit column stacking all three lists — and `panelShape` still
      reports a correct-looking 40rem, so every source-level check stays
      green. The e2e next door measures the panel for being too WIDE, which a
      collapsed panel is not.
    */
    const { MegaMenu } = await import("@/components/storefront/mega-menu");

    const cases = [
      { name: "one axis", occasions: [], collections: [] },
      { name: "two axes", occasions: OCCASIONS, collections: [] },
      { name: "three axes", occasions: OCCASIONS, collections: COLLECTIONS },
    ];

    for (const shape of cases) {
      const el = await mount(MegaMenu, {
        isActive: false,
        // With a picture, so the `-card` keys are exercised too.
        categories: [{ ...CATEGORIES[0], image: "https://example.test/c.jpg" }, CATEGORIES[1]],
        occasions: shape.occasions,
        collections: shape.collections,
        words: WORDS,
      });
      const grid = el.querySelector("[data-mega-panel] .grid");
      expect(grid, `${shape.name}: no panel grid rendered`).not.toBeNull();
      expect(
        grid!.className,
        `${shape.name}: the grid has no track definition — TAXONOMY_GRID is missing this key`,
      ).toMatch(/grid-cols-/);

      act(() => root!.unmount());
      container!.remove();
      root = null;
      container = null;
    }
  });

  it("does not widen past the envelope the nav band was measured against", async () => {
    /*
      `the-nav-band-is-a-band` pins this ceiling, and the `align` arithmetic
      in storefront-navbar was measured against it — a panel wider than 40rem
      is the -469px off-screen-left bug's home ground. Asserted on what the
      function RETURNS so a fourth column cannot claim the envelope in a
      comment.
    */
    const { panelShape } = await import("@/components/storefront/mega-menu");

    expect(panelShape(3, false).width).toContain("40rem");
    expect(panelShape(3, false).columns).toBe(3);
    // And asking for the card on top of three columns buys nothing but
    // narrower columns — which is why the component stops asking.
    expect(panelShape(3, true).width).toBe(panelShape(3, false).width);
  });
});
