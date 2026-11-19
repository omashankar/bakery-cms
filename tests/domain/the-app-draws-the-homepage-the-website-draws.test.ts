import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import type { LandingCategory, LandingProduct } from "@/constants/landing-data";
import { HomepageSectionRenderer } from "@/features/cms-sections/homepage-section-renderer";
import {
  contentNumber as rendererContentNumber,
  contentString as rendererContentString,
} from "@/features/cms-sections/section-parts";
import {
  contentNumber,
  contentString,
  storefrontHomeFrom,
  storefrontSectionOf,
  type StorefrontHomeInput,
  type StorefrontHomeSection,
} from "@/features/cms-sections/lib/storefront-home";
import type {
  HomepageSectionInstance,
  HomepageSectionType,
  SectionBackground,
} from "@/types/homepage-builder";

/**
 * THE APP DRAWS THE HOMEPAGE THE WEBSITE DRAWS.
 *
 * `/api/storefront/home` hands the phone app the published homepage as data:
 * which bands, in which order, and which products and categories each one
 * shows. The website decides all of that inside `HomepageSectionRenderer`, so
 * the mapper is a restatement of the renderer's rules — and a restatement is
 * exactly the thing that drifts. These pin each band's rule, and the parity
 * block at the bottom renders the REAL renderer over the same data and holds
 * the two to the same items in the same order.
 */

function product(slug: string): LandingProduct {
  return {
    id: `id-${slug}`,
    name: `Name ${slug}`,
    slug,
    description: "",
    price: 500,
    image: `https://img.example/${slug}.webp`,
    category: "Cakes",
    rating: 4.5,
    reviewCount: 3,
    inStock: true,
  } as unknown as LandingProduct;
}

const products = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => product(`${prefix}-${i + 1}`));

function category(slug: string, image = `/uploads/${slug}.webp`): LandingCategory {
  return { id: `cat-${slug}`, name: `Cat ${slug}`, slug, image, count: 3 };
}

const TRUST = {
  freeDeliveryThreshold: 999,
  deliveryPromise: "Same-day delivery",
  rating: { count: 27, average: 4.66 },
  sameDayCutoff: "14:00",
  sameDayTimeLeft: "02:10:05",
};

function shop(overrides: Partial<StorefrontHomeInput> = {}): StorefrontHomeInput {
  return {
    rails: {
      featured: products("featured", 12),
      trending: products("trending", 12),
      "best-sellers": products("best", 12),
      "photo-cakes": products("photo", 12),
      eggless: products("eggless", 12),
      seasonal: products("seasonal", 12),
    },
    categoryRails: { birthday: products("birthday", 12), wedding: products("wedding", 3) },
    flaggedCategoryRails: {
      "best-sellers": { birthday: products("best-birthday", 9), wedding: products("best-wedding", 2) },
    },
    categoryStartingPrices: { birthday: 450 },
    categories: [category("birthday"), category("wedding"), category("pastries"), category("eggless")],
    categoryChoices: [
      category("birthday"),
      category("wedding"),
      category("pastries"),
      category("eggless"),
      category("chocolate", ""),
    ],
    trust: TRUST,
    productWordPlural: "Cakes",
    currency: "INR",
    timezone: "Asia/Kolkata",
    menu: [{ label: "Cakes", href: "/store/collections/cakes", imageUrl: null }],
    ...overrides,
  };
}

function band(
  type: HomepageSectionType | string,
  content: Record<string, string | number | boolean> = {},
  extra: Partial<HomepageSectionInstance> = {},
): HomepageSectionInstance {
  return {
    instanceId: `${type}-1`,
    type: type as HomepageSectionType,
    order: 0,
    isVisible: true,
    background: "white" as SectionBackground,
    content,
    ...extra,
  };
}

const map = (section: HomepageSectionInstance, input = shop()) => storefrontSectionOf(section, input);

function as<T extends StorefrontHomeSection["type"]>(
  section: StorefrontHomeSection | null,
  type: T,
): Extract<StorefrontHomeSection, { type: T }> {
  expect(section, `expected a ${type} band, got nothing`).not.toBeNull();
  expect(section!.type).toBe(type);
  return section as Extract<StorefrontHomeSection, { type: T }>;
}

describe("the content readers are the renderer's", () => {
  it("read every shape the same way section-parts.tsx does", () => {
    const content = { a: "x", b: 3, c: "7", d: "", e: true, f: "abc", g: 0 } as Record<
      string,
      string | number | boolean
    >;
    for (const key of ["a", "b", "c", "d", "e", "f", "g", "missing"]) {
      expect(contentString(content, key, "fb")).toBe(rendererContentString(content, key, "fb"));
      expect(contentNumber(content, key, 4)).toBe(rendererContentNumber(content, key, 4));
    }
  });
});

describe("hero", () => {
  const slides = (rows: object[]) => ({ slides: JSON.stringify(rows) });

  it("drops a slide with no picture and keeps the rest in order", () => {
    const hero = as(
      map(
        band(
          "hero",
          slides([
            { headline: "", imageUrl: "https://img/1.webp", primaryHref: "/store/collections/birthday", imageAlt: "Birthday" },
            { headline: "Words but no picture", imageUrl: "" },
            { headline: "", imageUrl: "/uploads/3.webp", mobileImageUrl: "/uploads/3m.webp" },
          ]),
        ),
      ),
      "hero",
    );
    expect(hero.slides.map((s) => s.imageUrl)).toEqual(["https://img/1.webp", "/uploads/3.webp"]);
    expect(hero.slides[1].mobileImageUrl).toBe("/uploads/3m.webp");
    expect(hero.slides[0].imageAlt).toBe("Birthday");
  });

  it("artwork with no headline is one link and no button", () => {
    const hero = as(map(band("hero", slides([{ headline: "", imageUrl: "/u/1.webp", primaryLabel: "Buy" }]))), "hero");
    expect(hero.slides[0]).toMatchObject({ title: null, subtitle: null, ctaLabel: null, href: "/store/collections" });
  });

  it("a headline brings its words and a button, labelled with the shop's own noun when blank", () => {
    const hero = as(
      map(band("hero", slides([{ headline: "Fresh today", subtext: " Baked at dawn ", badge: "New", imageUrl: "/u/1.webp" }]))),
      "hero",
    );
    expect(hero.slides[0]).toMatchObject({
      title: "Fresh today",
      subtitle: "Baked at dawn",
      badge: "New",
      ctaLabel: "Shop Cakes",
      href: "/store/collections",
    });
  });

  it("a hero with no picture at all is not a band", () => {
    expect(map(band("hero", slides([{ headline: "Hi", imageUrl: "" }])))).toBeNull();
  });
});

describe("shop promises", () => {
  it("states the website's exact words from the shop's own figures", () => {
    const promises = as(map(band("shop-promises", { showRating: true, showFreeDelivery: true, showDelivery: true })), "promises");
    expect(promises.items).toEqual([
      { kind: "rating", title: "4.7 rating", subtitle: "From 27 reviews" },
      { kind: "free-delivery", title: "Free Delivery", subtitle: "On orders over ₹999" },
      { kind: "delivery", title: "Same-day delivery", subtitle: "Order by 14:00" },
    ]);
    expect(promises.title).toBeNull();
  });

  it("shows only what is switched on, and nothing for an unread shop", () => {
    const some = as(map(band("shop-promises", { showRating: false, showFreeDelivery: "false", showDelivery: true })), "promises");
    expect(some.items.map((i) => i.kind)).toEqual(["delivery"]);
    expect(map(band("shop-promises", {}), shop({ trust: null }))).toBeNull();
  });

  it("free on every order when there is no threshold", () => {
    const promises = as(
      map(band("shop-promises", { showRating: false, showDelivery: false }), shop({ trust: { ...TRUST, freeDeliveryThreshold: 0 } })),
      "promises",
    );
    expect(promises.items).toEqual([{ kind: "free-delivery", title: "Free Delivery", subtitle: "On every order" }]);
  });
});

describe("our menu (categories)", () => {
  it("is the first maxCount of the automatic row when nothing is picked", () => {
    const menu = as(map(band("our-menu", { title: "Shop by category", maxCount: 3 })), "categories");
    expect(menu.categorySlugs).toEqual(["birthday", "wedding", "pastries"]);
    expect(menu.title).toBe("Shop by category");
  });

  it("is the shop's picks in its order — overrides kept, gone ones dropped, maxCount ignored", () => {
    const menu = as(
      map(
        band("our-menu", {
          maxCount: 1,
          picks: JSON.stringify([
            { categorySlug: "chocolate", label: "Choc", image: "/u/choc.webp" },
            { categorySlug: "deleted-one" },
            { categorySlug: "wedding" },
          ]),
        }),
      ),
      "categories",
    );
    expect(menu.categorySlugs).toEqual(["chocolate", "wedding"]);
    expect(menu.items[0]).toMatchObject({ slug: "chocolate", name: "Choc", imageUrl: "/u/choc.webp" });
    expect(menu.items[1]).toMatchObject({ name: "Cat wedding", imageUrl: "/uploads/wedding.webp" });
  });

  it("draws nothing when there is nothing to draw", () => {
    expect(map(band("our-menu", {}), shop({ categories: [] }))).toBeNull();
  });
});

describe("same-day countdown", () => {
  const content = { headline: "Time left to order", ctaLabel: "Shop now", ctaHref: "/store/collections" };

  it("carries the shop's cutoff, its zone and its button", () => {
    const countdown = as(map(band("same-day-countdown", content)), "countdown");
    expect(countdown).toMatchObject({
      headline: "Time left to order",
      cutoffTime: "14:00",
      timezone: "Asia/Kolkata",
      cta: { label: "Shop now", href: "/store/collections" },
    });
  });

  it("is absent with no window, no line, or once today's has closed", () => {
    expect(map(band("same-day-countdown", content), shop({ trust: { ...TRUST, sameDayCutoff: "" } }))).toBeNull();
    expect(map(band("same-day-countdown", { ...content, headline: "  " }))).toBeNull();
    expect(map(band("same-day-countdown", content), shop({ trust: { ...TRUST, sameDayTimeLeft: null } }))).toBeNull();
    expect(map(band("same-day-countdown", content), shop({ trust: null }))).toBeNull();
  });

  it("has no button without both halves", () => {
    expect(as(map(band("same-day-countdown", { ...content, ctaHref: "" })), "countdown").cta).toBeNull();
  });
});

describe("banners", () => {
  const grid = (rows: object[], extra: Record<string, string> = {}) =>
    band("banner-grid", { banners: JSON.stringify(rows), ...extra });

  it("a mixed grid lays a lone wide tile across a phone row, as the website does", () => {
    const banners = as(
      map(
        grid([
          { image: "/a.webp", wide: "true", href: "/store/collections/birthday", label: "Birthday" },
          { image: "/b.webp", wide: "true" },
          { image: "/c.webp", wide: "true" },
          { image: "/d.webp", wide: "false" },
          { image: "/e.webp", wide: "false" },
        ]),
      ),
      "banners",
    );
    expect(banners.layout).toBe("grid");
    expect(banners.shape).toBe("mixed");
    expect(banners.items.map((b) => b.span)).toEqual([1, 1, 2, 1, 1]);
    expect(banners.items[0]).toMatchObject({ href: "/store/collections/birthday", imageAlt: "Birthday", title: null });
    expect(banners.items[0].aspectRatio).toBeCloseTo(1.1);
    expect(banners.items[3].aspectRatio).toBeCloseTo(2 / 3);
  });

  it("an even row is one column on a phone at the band's own ratio", () => {
    const banners = as(map(grid([{ image: "/a.webp" }, { image: "/b.webp" }], { columns: "3" })), "banners");
    expect(banners.shape).toBe("3-across");
    expect(banners.items.every((b) => b.span === 2 && Math.abs(b.aspectRatio - 493 / 290) < 1e-9)).toBe(true);
  });

  it("the turning strip takes at most three, only those with a picture", () => {
    const strip = as(
      map(
        band("banner-strip", {
          shape: "banner",
          title: "Treats",
          overline: "TREATS",
          ctaLabel: "",
          ctaHref: "VIEW ALL",
          banners: JSON.stringify([
            { image: "/1.webp" },
            { image: "", label: "no picture" },
            { image: "/2.webp", mobileImage: "/2m.webp" },
            { image: "/3.webp" },
            { image: "/4.webp" },
          ]),
        }),
      ),
      "banners",
    );
    expect(strip.layout).toBe("strip");
    expect(strip.shape).toBe("banner");
    expect(strip.items.map((b) => b.imageUrl)).toEqual(["/1.webp", "/2.webp", "/3.webp"]);
    // A phone picture anywhere makes the whole strip the tall phone box.
    expect(strip.items[0].aspectRatio).toBeCloseTo(760 / 400);
    // The overline only repeats the title, so the website does not draw it.
    expect(strip.overline).toBeNull();
    expect(strip.title).toBe("Treats");
    // A link with no label is not a link.
    expect(strip.cta).toBeNull();
  });

  it("an unknown strip shape is the thin strip", () => {
    const strip = as(map(band("banner-strip", { shape: "toString", banners: JSON.stringify([{ image: "/1.webp" }]) })), "banners");
    expect(strip.shape).toBe("strip");
    expect(strip.items[0].aspectRatio).toBeCloseTo(1520 / 120);
  });

  it("no banners, no band", () => {
    expect(map(grid([]))).toBeNull();
    expect(map(band("banner-strip", { banners: JSON.stringify([{ image: "", label: "x" }]) }))).toBeNull();
  });
});

describe("product rows", () => {
  const ROWS: [HomepageSectionType, string][] = [
    ["featured-cakes", "featured"],
    ["trending", "trending"],
    ["best-sellers", "best"],
    ["photo-cakes", "photo"],
    ["eggless", "eggless"],
    ["seasonal", "seasonal"],
  ];

  it.each(ROWS)("%s shows its own rail, cut to maxCount", (type, prefix) => {
    const row = as(map(band(type, { maxCount: 3, title: "Row" })), "products");
    expect(row.productSlugs).toEqual([`${prefix}-1`, `${prefix}-2`, `${prefix}-3`]);
  });

  it("four when maxCount is unset", () => {
    expect(as(map(band("trending")), "products").productSlugs).toHaveLength(4);
  });

  it("a category rail shows that category, and nothing for one that is gone", () => {
    const row = as(
      map(band("category-rail", { categorySlug: "birthday", maxCount: 5, ctaLabel: "View all", ctaHref: "/store/collections/birthday" })),
      "products",
    );
    expect(row.productSlugs).toEqual(["birthday-1", "birthday-2", "birthday-3", "birthday-4", "birthday-5"]);
    expect(row.cta).toEqual({ label: "View all", href: "/store/collections/birthday" });
    expect(map(band("category-rail", { categorySlug: "gone" }))).toBeNull();
  });

  it("an empty row is not a band", () => {
    expect(map(band("best-sellers"), shop({ rails: { ...shop().rails, "best-sellers": [] } }))).toBeNull();
  });
});

describe("tabbed rail", () => {
  const tabs = JSON.stringify([
    { label: "Weddings", categorySlug: "wedding" },
    { label: "", categorySlug: "birthday" },
    { label: "No slug" },
    { label: "Third", categorySlug: "empty-one" },
  ]);

  it("tabs in order, each cut to maxCount, from the flagged rail when the row has a source", () => {
    const rail = as(map(band("tabbed-rail", { tabs, maxCount: 3, source: "best-sellers", ctaLabel: "View all", ctaHref: "/store/collections" })), "tabs");
    expect(rail.tabs).toEqual([
      { label: "Weddings", href: null, productSlugs: ["best-wedding-1", "best-wedding-2"] },
      { label: "birthday", href: null, productSlugs: ["best-birthday-1", "best-birthday-2", "best-birthday-3"] },
      { label: "Third", href: null, productSlugs: [] },
    ]);
    expect(rail.cta).toEqual({ label: "View all", href: "/store/collections" });
  });

  it("from the category itself with no source, and no more tabs than maxTabs", () => {
    const rail = as(map(band("tabbed-rail", { tabs, maxTabs: 1 })), "tabs");
    expect(rail.tabs).toEqual([{ label: "Weddings", href: null, productSlugs: ["wedding-1", "wedding-2", "wedding-3"] }]);
  });

  it("no tabs, no band", () => {
    expect(map(band("tabbed-rail", { tabs: JSON.stringify([{ label: "No slug" }]) }))).toBeNull();
  });
});

describe("recently viewed", () => {
  it("is always sent, with its count clamped to what the browser can hold", () => {
    expect(as(map(band("recently-viewed", { maxCount: 20 })), "recently-viewed").maxCount).toBe(8);
    expect(as(map(band("recently-viewed", { maxCount: 4 })), "recently-viewed").maxCount).toBe(4);
  });
});

describe("the page as a whole", () => {
  const published = [
    band("trending", { maxCount: 2 }, { instanceId: "t", order: 5 }),
    band("best-sellers", {}, { instanceId: "hidden", order: 1, isVisible: false }),
    band("hero", { slides: JSON.stringify([{ headline: "", imageUrl: "/h.webp" }]) }, { instanceId: "h", order: 0 }),
    band("testimonials", {}, { instanceId: "testimonials", order: 2 }),
    band("faq", {}, { instanceId: "faq", order: 3 }),
    band("offers", {}, { instanceId: "offers", order: 4 }),
    band("newsletter", {}, { instanceId: "newsletter", order: 6 }),
    band("why-us", { items: JSON.stringify([{ title: "x" }]) }, { instanceId: "why", order: 7 }),
    band("photo-cakes", {}, { instanceId: "empty", order: 8 }),
  ];
  const draft = [band("eggless", {}, { instanceId: "draft-only", order: 0 })];

  function page(input = shop({ rails: { ...shop().rails, "photo-cakes": [] } })) {
    return storefrontHomeFrom(
      {
        published: { sections: published, updatedAt: "2026-10-27T06:41:38.205Z" },
        draft: { sections: draft, updatedAt: "2026-11-01T00:00:00.000Z", scheduledPublishAt: "2026-12-01T00:00:00.000Z" },
      } as Parameters<typeof storefrontHomeFrom>[0],
      input,
    );
  }

  it("is the published snapshot in order: hidden, empty and unknown bands left out", () => {
    const home = page();
    expect(home.updatedAt).toBe("2026-10-27T06:41:38.205Z");
    expect(home.sections.map((s) => s.id)).toEqual(["h", "t"]);
  });

  it("carries the header band's rows it was handed, as they are", () => {
    expect(page().menu).toEqual([{ label: "Cakes", href: "/store/collections/cakes", imageUrl: null }]);
  });

  it("never reads the draft, and carries nothing of the builder", () => {
    const body = JSON.stringify(page());
    expect(body).not.toContain("draft-only");
    expect(body).not.toContain("scheduledPublishAt");
    expect(body).not.toContain("2026-12-01");
    expect(body).not.toContain("isVisible");
    expect(body).not.toContain("content");
  });

  it("every band carries the common fields, the background as stored", () => {
    const [hero] = page().sections;
    expect(Object.keys(hero).sort()).toEqual(
      ["background", "cta", "description", "id", "overline", "slides", "title", "type"].sort(),
    );
    const panel = storefrontSectionOf(band("trending", {}, { background: "panel-mint" }), shop());
    expect(panel!.background).toBe("panel-mint");
  });
});

/* ── parity: the renderer itself, over the same data ─────────────────────── */

const EMPTY_RENDER_EXTRAS = {
  catalog: [],
  offers: [],
  testimonials: [],
  faqs: [],
  banners: [],
  instagram: null,
  storeLocation: null,
};

function rendered(section: HomepageSectionInstance, input: StorefrontHomeInput): string {
  return renderToStaticMarkup(
    createElement(HomepageSectionRenderer, {
      ...EMPTY_RENDER_EXTRAS,
      ...(input as unknown as Record<string, unknown>),
      section,
    } as unknown as Parameters<typeof HomepageSectionRenderer>[0]),
  );
}

/** Every distinct href matching `pattern`, in the order the HTML has them. */
function linksIn(html: string, pattern: RegExp): string[] {
  const seen: string[] = [];
  for (const match of html.matchAll(/href="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, "&");
    if (pattern.test(href) && seen.at(-1) !== href && !seen.includes(href)) seen.push(href);
  }
  return seen;
}

describe("parity with the renderer", () => {
  const PRODUCT = /^\/store\/p\//;

  it.each([
    ["trending", { maxCount: 3 }],
    ["photo-cakes", { maxCount: 6 }],
    ["best-sellers", {}],
    ["category-rail", { categorySlug: "birthday", maxCount: 7 }],
  ] as [HomepageSectionType, Record<string, string | number>][])(
    "%s: the same products, in the same order",
    (type, content) => {
      const section = band(type, content);
      const app = as(map(section), "products");
      expect(app.productSlugs.length).toBeGreaterThan(0);
      expect(linksIn(rendered(section, shop()), PRODUCT)).toEqual(app.productSlugs.map((slug) => `/store/p/${slug}`));
    },
  );

  it("tabbed rail: the first tab's products are the ones the page opens on", () => {
    const section = band("tabbed-rail", {
      tabs: JSON.stringify([{ label: "B", categorySlug: "birthday" }, { label: "W", categorySlug: "wedding" }]),
      maxCount: 5,
      source: "best-sellers",
    });
    const app = as(map(section), "tabs");
    expect(linksIn(rendered(section, shop()), PRODUCT)).toEqual(app.tabs[0].productSlugs.map((slug) => `/store/p/${slug}`));
  });

  it("our menu: the same category tiles, in the same order", () => {
    const variants: Record<string, string | number>[] = [
      { maxCount: 3 },
      { picks: JSON.stringify([{ categorySlug: "eggless" }, { categorySlug: "gone" }, { categorySlug: "birthday" }]) },
    ];
    for (const content of variants) {
      const section = band("our-menu", content);
      const app = as(map(section), "categories");
      expect(linksIn(rendered(section, shop()), /^\/store\/collections\//)).toEqual(
        app.categorySlugs.map((slug) => `/store/collections/${slug}`),
      );
    }
  });

  it("banner grid: the same banners link to the same places", () => {
    const section = band("banner-grid", {
      banners: JSON.stringify([
        { image: "/a.webp", href: "/store/collections/a", wide: "true" },
        { image: "/b.webp", href: "/store/collections/b" },
      ]),
    });
    const app = as(map(section), "banners");
    expect(linksIn(rendered(section, shop()), /^\/store\//)).toEqual(app.items.map((b) => b.href));
  });

  /*
    THE EMPTY CASE OVER THE WHOLE REGISTRY: wherever the website draws nothing
    for a shop with nothing in it, the app is sent nothing either. Walked over
    the registry so a band type added later is held to it unasked.
  */
  it("a band the website leaves off an empty shop's page is not sent", () => {
    const empty = shop({
      rails: { featured: [], trending: [], "best-sellers": [], "photo-cakes": [], eggless: [], seasonal: [] },
      categoryRails: {},
      flaggedCategoryRails: {},
      categories: [],
      categoryChoices: [],
      trust: { ...TRUST, rating: null, sameDayCutoff: "", sameDayTimeLeft: null, deliveryPromise: "", freeDeliveryThreshold: 0 },
    });
    let checked = 0;
    for (const entry of HOMEPAGE_SECTION_REGISTRY) {
      // Different for every visitor: the website fills it in the browser, the app from its own history.
      if (entry.type === "recently-viewed") continue;
      const section = band(entry.type, entry.defaultContent);
      if (rendered(section, empty).trim() !== "") continue;
      checked += 1;
      expect(storefrontSectionOf(section, empty), `${entry.type} is sent though the website draws nothing`).toBeNull();
    }
    expect(checked).toBeGreaterThan(5);
  });
});
