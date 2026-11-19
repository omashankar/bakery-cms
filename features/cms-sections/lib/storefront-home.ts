import { routes } from "@/constants/routes";
import { parseHeroSlides } from "@/constants/section-registry";
import {
  BANNER_STRIP_MAX,
  parseListField,
  renderableRows,
  rowFlag,
} from "@/constants/section-list-fields";
import type { LandingCategory } from "@/constants/landing-data";
import { RECENTLY_VIEWED_MAX } from "@/features/products/lib/recently-viewed";
import type { HomepageProductSource } from "@/features/products/lib/homepage-rails";
import { formatCurrency } from "@/utils/format";
import type {
  HomepageBuilderSnapshot,
  HomepageSectionInstance,
  SectionBackground,
} from "@/types/homepage-builder";
import { heroSlidesFor, homepageSectionsToRender } from "./section-utils";
import type { StorefrontHomeMenuItem } from "./storefront-menu";

export type { StorefrontHomeMenuItem } from "./storefront-menu";

/**
 * THE PUBLISHED HOMEPAGE, AS DATA — for the phone app.
 *
 * The website draws its homepage with `HomepageSectionRenderer`; the app has
 * no renderer to borrow, only this. So every rule below is the RENDERER'S
 * rule, restated against the same inputs: which rows, in which order, the
 * same `maxCount` slices, the same "draws nothing" cases. A band the website
 * leaves off the page is left out of `sections` here, because an app that
 * draws a heading over nothing is the bug the website already fixed.
 *
 * WHAT IT IS GIVEN IS WHAT THE WEBSITE IS GIVEN: the rails, categories and
 * trust figures `getHomepageRenderData` computes (the server module beside it
 * composes them), never a second selection of its own. And it is handed the
 * WHOLE builder state on purpose, so the one place that chooses `published`
 * over `draft` is this file — and a test can hold it to that.
 *
 * Pure: no database, no React, nothing from `apps/*` (domainStaysPure).
 * Products and categories go out as SLUGS — the app has already downloaded
 * both catalogues, and a full product per card would be the same payload
 * twice.
 */

/** A product card, as far as this file needs one. */
interface SlugOnly {
  slug: string;
}

/** The shop's figures, structurally — `StorefrontTrust` lives in apps/website. */
export interface StorefrontHomeTrust {
  freeDeliveryThreshold: number;
  deliveryPromise: string;
  rating: { count: number; average: number } | null;
  sameDayCutoff: string;
  sameDayTimeLeft: string | null;
}

export interface StorefrontHomeInput {
  rails: Partial<Record<HomepageProductSource, SlugOnly[]>>;
  categoryRails: Record<string, SlugOnly[]>;
  flaggedCategoryRails: Partial<Record<HomepageProductSource, Record<string, SlugOnly[]>>>;
  categoryStartingPrices: Record<string, number>;
  /** The automatic category row: pictured, capped. */
  categories: LandingCategory[];
  /** Every category, for a band whose categories the shop picked by hand. */
  categoryChoices: LandingCategory[];
  /** Null when the shop's settings could not be read — figures draw nothing. */
  trust: StorefrontHomeTrust | null;
  /** The shop's own plural noun, for the hero button nobody labelled. */
  productWordPlural: string;
  /** The shop's currency code, so a price reads the way the website writes it. */
  currency?: string;
  /** The shop's IANA zone — the clock its same-day cutoff is read on. */
  timezone: string;
  /** The header band's rows, already chosen by `storefrontMenuFrom`. */
  menu: StorefrontHomeMenuItem[];
}

export interface StorefrontHomeCta {
  label: string;
  href: string;
}

interface SectionBase {
  id: string;
  background: SectionBackground;
  overline: string | null;
  title: string | null;
  description: string | null;
  cta: StorefrontHomeCta | null;
}

export interface StorefrontHomeHeroSlide {
  imageUrl: string;
  mobileImageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  href: string | null;
  /** Additive: the small chip above the headline, only drawn with a headline. */
  badge: string | null;
  /** Additive: the second button, only drawn with a headline. */
  secondaryCtaLabel: string | null;
  secondaryHref: string | null;
  /** Additive: what the picture says, for a screen reader. */
  imageAlt: string | null;
}

export interface StorefrontHomeBanner {
  imageUrl: string;
  mobileImageUrl: string | null;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  href: string | null;
  /** Additive: what the picture says, for a screen reader (its words are pixels). */
  imageAlt: string | null;
  /** Additive: width / height of the box the website draws it in on a phone. */
  aspectRatio: number;
  /** Additive: how many columns of a two-column phone grid it takes (grid only). */
  span: 1 | 2;
}

export interface StorefrontHomeCategoryItem {
  slug: string;
  /** The name the tile shows — the shop's override, or the category's own. */
  name: string;
  /** The picture the tile shows — the shop's override, or the category's own. */
  imageUrl: string | null;
  /** Category price cards only: the cheapest live price in the category. */
  startingPrice: number | null;
  /** Category price cards only: the words before that price. */
  priceLabel: string | null;
}

export type StorefrontHomeSection =
  | (SectionBase & { type: "hero"; slides: StorefrontHomeHeroSlide[] })
  | (SectionBase & {
      type: "promises";
      items: { kind: string; title: string; subtitle: string | null }[];
    })
  | (SectionBase & {
      type: "categories";
      categorySlugs: string[];
      /** Additive: the slugs again, with the name and picture each tile shows. */
      items: StorefrontHomeCategoryItem[];
    })
  | (SectionBase & {
      type: "countdown";
      headline: string;
      cutoffTime: string;
      timezone: string;
    })
  | (SectionBase & {
      type: "banners";
      layout: "grid" | "strip";
      shape: string | null;
      items: StorefrontHomeBanner[];
    })
  | (SectionBase & { type: "products"; productSlugs: string[] })
  | (SectionBase & {
      type: "tabs";
      tabs: { label: string; href: string | null; productSlugs: string[] }[];
    })
  | (SectionBase & { type: "recently-viewed"; maxCount: number });

export interface StorefrontHome {
  updatedAt: string;
  sections: StorefrontHomeSection[];
  /**
   * Additive: the top-level rows of the website's header band, in its order
   * — the app draws them as a row of tabs under its search bar.
   */
  menu: StorefrontHomeMenuItem[];
}

type Content = HomepageSectionInstance["content"];

/* The renderer's own readers (section-parts.tsx), restated so this file does
   not import a module of React components. A test holds the two to agreeing. */
export function contentString(content: Content, key: string, fallback = ""): string {
  const value = content[key];
  return typeof value === "string" ? value : fallback;
}

export function contentNumber(content: Content, key: string, fallback: number): number {
  const value = content[key];
  return typeof value === "number" ? value : Number(value) || fallback;
}

function blankToNull(value: string | undefined | null): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

/**
 * The heading as `SectionHeader` draws it: blank lines draw nothing, and an
 * overline that only repeats the title is not drawn twice.
 */
function headingOf(c: Content): Pick<SectionBase, "overline" | "title" | "description"> {
  const title = blankToNull(contentString(c, "title"));
  const overline = blankToNull(contentString(c, "overline"));
  return {
    overline: overline && !(title && overline.toLowerCase() === title.toLowerCase()) ? overline : null,
    title,
    // The renderer reads `subtitle`. Some stored sections also carry a
    // `description` key, which nothing on the website draws.
    description: blankToNull(contentString(c, "subtitle")),
  };
}

const NO_HEADING = { overline: null, title: null, description: null } as const;

/** `ViewAllLink`: nothing without both halves. */
function ctaOf(c: Content, labelKey = "ctaLabel", hrefKey = "ctaHref"): StorefrontHomeCta | null {
  const label = contentString(c, labelKey);
  const href = contentString(c, hrefKey);
  if (!label || !href) return null;
  return { label: label.trim(), href: href.trim() };
}

function slugsOf(rows: readonly SlugOnly[] | undefined, maxCount: number): string[] {
  return (rows ?? []).slice(0, maxCount).map((row) => row.slug);
}

/** The flag-driven and category-frozen rows, by section type. */
const RAIL_SOURCES: Partial<Record<HomepageSectionInstance["type"], HomepageProductSource>> = {
  "featured-cakes": "featured",
  trending: "trending",
  "best-sellers": "best-sellers",
  "photo-cakes": "photo-cakes",
  eggless: "eggless",
  seasonal: "seasonal",
};

/* ── one function per band, each the renderer's band restated ─────────── */

function heroOf(section: HomepageSectionInstance, input: StorefrontHomeInput) {
  const fallbackLabel = `Shop ${input.productWordPlural}`;
  // HeroSection's own mapping, then `heroSlidesFor`: a slide IS its picture.
  const slides = heroSlidesFor(
    parseHeroSlides(section.content).map((slide) => ({
      badge: slide.badge?.trim() || undefined,
      headline: slide.headline ?? "",
      subtext: slide.subtext?.trim() || undefined,
      primaryLabel: slide.primaryLabel?.trim() || fallbackLabel,
      primaryHref: slide.primaryHref?.trim() || routes.store.collections,
      secondaryLabel: slide.secondaryLabel?.trim() || undefined,
      secondaryHref: slide.secondaryHref?.trim() || undefined,
      imageUrl: slide.imageUrl ?? "",
      imageAlt: slide.imageAlt,
      mobileImageUrl: slide.mobileImageUrl,
    })),
  );
  if (slides.length === 0) return null;

  return {
    type: "hero" as const,
    ...NO_HEADING,
    cta: null,
    slides: slides.map((slide): StorefrontHomeHeroSlide => {
      /*
        WITH A HEADLINE the words and buttons are laid over the picture.
        WITHOUT ONE the slide is finished artwork and the whole picture is the
        link — no button, so no button label (hero-carousel.tsx).
      */
      const words = Boolean(slide.headline);
      return {
        imageUrl: slide.imageUrl,
        mobileImageUrl: blankToNull(slide.mobileImageUrl),
        title: words ? blankToNull(slide.headline) : null,
        subtitle: words ? blankToNull(slide.subtext) : null,
        ctaLabel: words ? slide.primaryLabel : null,
        href: slide.primaryHref,
        badge: words ? blankToNull(slide.badge) : null,
        secondaryCtaLabel:
          words && slide.secondaryLabel && slide.secondaryHref ? slide.secondaryLabel : null,
        secondaryHref:
          words && slide.secondaryLabel && slide.secondaryHref ? slide.secondaryHref : null,
        imageAlt: blankToNull(slide.imageAlt),
      };
    }),
  };
}

/** ShopPromisesSection + heroTrustBarFor. */
function promisesOf(section: HomepageSectionInstance, input: StorefrontHomeInput) {
  const c = section.content;
  const show = (key: string) => c[key] !== false && c[key] !== "false";
  const trust = input.trust;
  const items: { kind: string; title: string; subtitle: string | null }[] = [];

  if (show("showRating") && trust?.rating && trust.rating.count > 0) {
    items.push({
      kind: "rating",
      title: `${trust.rating.average.toFixed(1)} rating`,
      subtitle: `From ${trust.rating.count} ${trust.rating.count === 1 ? "review" : "reviews"}`,
    });
  }
  if (trust) {
    if (show("showFreeDelivery")) {
      items.push({
        kind: "free-delivery",
        title: "Free Delivery",
        subtitle:
          trust.freeDeliveryThreshold > 0
            ? `On orders over ${formatCurrency(trust.freeDeliveryThreshold, input.currency)}`
            : "On every order",
      });
    }
    if (show("showDelivery") && trust.deliveryPromise) {
      items.push({
        kind: "delivery",
        title: trust.deliveryPromise,
        subtitle: trust.sameDayCutoff ? `Order by ${trust.sameDayCutoff}` : null,
      });
    }
  }
  if (items.length === 0) return null;
  // The band draws no heading and no link of its own.
  return { type: "promises" as const, ...NO_HEADING, cta: null, items };
}

/** OurMenuSection + categoriesForBand. */
function ourMenuOf(section: HomepageSectionInstance, input: StorefrontHomeInput) {
  const c = section.content;
  const maxCount = contentNumber(c, "maxCount", 8);
  const rows = renderableRows(parseListField(c, "picks"));
  const picks = rows.filter((row) => String(row.categorySlug ?? "").trim());

  let chosen: LandingCategory[];
  if (picks.length === 0) {
    chosen = input.categories.slice(0, maxCount);
  } else {
    // A map, not a filter: two categories can share a slug.
    const bySlug = new Map<string, LandingCategory>();
    for (const category of input.categoryChoices) {
      if (!bySlug.has(category.slug)) bySlug.set(category.slug, category);
    }
    chosen = picks.flatMap((row) => {
      const found = bySlug.get(String(row.categorySlug ?? "").trim());
      if (!found) return [];
      const label = String(row.label ?? "").trim();
      const image = String(row.image ?? "").trim();
      return [{ ...found, name: label || found.name, image: image || found.image }];
    });
  }
  if (chosen.length === 0) return null;

  return {
    type: "categories" as const,
    ...headingOf(c),
    cta: null,
    categorySlugs: chosen.map((category) => category.slug),
    items: chosen.map(
      (category): StorefrontHomeCategoryItem => ({
        slug: category.slug,
        name: category.name,
        imageUrl: blankToNull(category.image),
        startingPrice: null,
        priceLabel: null,
      }),
    ),
  };
}

/** CategoryPriceCardsSection. */
function priceCardsOf(section: HomepageSectionInstance, input: StorefrontHomeInput) {
  const c = section.content;
  const rows = renderableRows(parseListField(c, "items"));
  if (rows.length === 0) return null;

  const nameOf = new Map(input.categories.map((category) => [category.slug, category.name]));
  const priceLabel = contentString(c, "priceLabel") || "Starting from";
  /*
    A card with no category is drawn on the website as an unlinked picture.
    It names no category, so it has no place in `categorySlugs` — the one
    case this band loses on the app.
  */
  const items = rows.flatMap((item): StorefrontHomeCategoryItem[] => {
    const slug = (item.categorySlug ?? "").trim();
    if (!slug) return [];
    const price = input.categoryStartingPrices[slug];
    const startingPrice =
      typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
    return [
      {
        slug,
        name: (item.label ?? "").trim() || nameOf.get(slug) || "",
        imageUrl: blankToNull(item.image),
        startingPrice,
        priceLabel: startingPrice === null ? null : priceLabel,
      },
    ];
  });
  if (items.length === 0) return null;

  return {
    type: "categories" as const,
    ...headingOf(c),
    cta: ctaOf(c),
    categorySlugs: items.map((item) => item.slug),
    items,
  };
}

/** SameDayCountdownSection, as the server renders it. */
function countdownOf(section: HomepageSectionInstance, input: StorefrontHomeInput) {
  const c = section.content;
  const cutoff = (input.trust?.sameDayCutoff ?? "").trim();
  const headline = contentString(c, "headline").trim();
  /*
    THREE WAYS THE WEBSITE DRAWS NOTHING, checked at the moment of the
    request: no same-day window (no cutoff, or a lead time above 0 — the
    server already collapsed both into ""), no line beside the clock, or
    today's cutoff has already gone (`sameDayTimeLeft` is null). The app
    should also take the band down itself when its own clock reaches the
    cutoff, the way the website's does.
  */
  if (!cutoff || !headline || !input.trust?.sameDayTimeLeft) return null;
  return {
    type: "countdown" as const,
    ...NO_HEADING,
    cta: ctaOf(c),
    headline,
    cutoffTime: cutoff,
    timezone: input.timezone,
  };
}

/** BANNER_ROW in the renderer: the even rows, by stored `columns`. */
const EVEN_ROWS: Record<string, { shape: string; aspectRatio: number }> = {
  "2": { shape: "2-across", aspectRatio: 750 / 290 },
  "3": { shape: "3-across", aspectRatio: 493 / 290 },
};

/** BannerGridSection. */
function bannerGridOf(section: HomepageSectionInstance) {
  const c = section.content;
  const banners = renderableRows(parseListField(c, "banners"));
  if (banners.length === 0) return null;
  const columns = contentString(c, "columns").trim();
  const across = Object.hasOwn(EVEN_ROWS, columns) ? EVEN_ROWS[columns] : undefined;

  /*
    THE COLLAGE ON A PHONE is two across, and a wide tile that would start a
    row with no wide partner takes the whole row — the renderer's own walk,
    so the app can lay the same grid.
  */
  const fullOnPhone = new Set<number>();
  if (!across) {
    let column = 0;
    banners.forEach((banner, index) => {
      const wide = rowFlag(banner.wide);
      const next = banners[index + 1];
      if (wide && column === 0 && !(next && rowFlag(next.wide))) {
        fullOnPhone.add(index);
        return;
      }
      column = (column + 1) % 2;
    });
  }

  const items = banners.flatMap((banner, index): StorefrontHomeBanner[] => {
    // A row with no picture is drawn as an empty grey box; the app has no use for one.
    const imageUrl = (banner.image ?? "").trim();
    if (!imageUrl) return [];
    const wide = rowFlag(banner.wide);
    return [
      {
        imageUrl,
        mobileImageUrl: null,
        // The words are pixels in the artwork; the website draws none over it.
        title: null,
        subtitle: null,
        ctaLabel: null,
        href: blankToNull(banner.href),
        imageAlt: blankToNull(banner.label),
        aspectRatio: across ? across.aspectRatio : wide ? 11 / 10 : 2 / 3,
        // An even row is one column on a phone; the collage is two.
        span: across || fullOnPhone.has(index) ? 2 : 1,
      },
    ];
  });
  if (items.length === 0) return null;

  return {
    type: "banners" as const,
    ...headingOf(c),
    cta: null,
    layout: "grid" as const,
    shape: across ? across.shape : "mixed",
    items,
  };
}

/** TileGridSection — labelled, linked picture tiles, two across on a phone. */
function tileGridOf(section: HomepageSectionInstance) {
  const c = section.content;
  const tiles = renderableRows(parseListField(c, "tiles"));
  if (tiles.length === 0) return null;
  const card = contentString(c, "shape").trim() === "card";

  const items = tiles.flatMap((tile): StorefrontHomeBanner[] => {
    const imageUrl = (tile.image ?? "").trim();
    if (!imageUrl) return [];
    return [
      {
        imageUrl,
        mobileImageUrl: null,
        // Unlike a banner, a tile's label IS drawn, under the picture.
        title: blankToNull(tile.label),
        subtitle: null,
        ctaLabel: null,
        href: blankToNull(tile.href),
        imageAlt: blankToNull(tile.label),
        aspectRatio: card ? 4 / 3 : 1,
        span: 1,
      },
    ];
  });
  if (items.length === 0) return null;

  return {
    type: "banners" as const,
    ...headingOf(c),
    cta: null,
    layout: "grid" as const,
    shape: card ? "tile-cards" : "tiles",
    items,
  };
}

/** STRIP_SHAPES in banner-strip-section.tsx, at phone width. */
const STRIP_SHAPES: Record<string, { wide: number; withPhone: number }> = {
  strip: { wide: 1520 / 120, withPhone: 760 / 200 },
  banner: { wide: 1520 / 330, withPhone: 760 / 400 },
};

/** BannerStripSection. */
function bannerStripOf(section: HomepageSectionInstance) {
  const c = section.content;
  const banners = renderableRows(parseListField(c, "banners"))
    .filter((banner) => Boolean(banner.image))
    .slice(0, BANNER_STRIP_MAX);
  if (banners.length === 0) return null;

  const stored = contentString(c, "shape");
  const shape = Object.hasOwn(STRIP_SHAPES, stored) ? stored : "strip";
  // One box for the whole strip: tall on a phone only if a phone picture exists.
  const withPhone = banners.some((banner) => banner.mobileImage?.trim());
  const aspectRatio = withPhone ? STRIP_SHAPES[shape].withPhone : STRIP_SHAPES[shape].wide;

  return {
    type: "banners" as const,
    ...headingOf(c),
    cta: ctaOf(c),
    layout: "strip" as const,
    shape,
    items: banners.map(
      (banner): StorefrontHomeBanner => ({
        imageUrl: banner.image,
        mobileImageUrl: blankToNull(banner.mobileImage),
        title: null,
        subtitle: null,
        ctaLabel: null,
        href: blankToNull(banner.href),
        imageAlt: blankToNull(banner.label),
        aspectRatio,
        span: 2,
      }),
    ),
  };
}

/** ProductGridSection, fed the way the renderer's switch feeds it. */
function productRowOf(section: HomepageSectionInstance, pool: readonly SlugOnly[] | undefined) {
  const c = section.content;
  const maxCount = contentNumber(c, "maxCount", 4);
  const productSlugs = slugsOf(pool, maxCount);
  if (productSlugs.length === 0) return null;
  return { type: "products" as const, ...headingOf(c), cta: ctaOf(c), productSlugs };
}

/** TabbedRailSection. */
function tabbedRailOf(section: HomepageSectionInstance, input: StorefrontHomeInput) {
  const c = section.content;
  const declared = renderableRows(parseListField(c, "tabs")).filter((tab) =>
    Boolean(tab.categorySlug),
  );
  // 0 — and a missing value — means every tab.
  const maxTabs = contentNumber(c, "maxTabs", 0);
  const tabs = maxTabs > 0 ? declared.slice(0, maxTabs) : declared;
  if (tabs.length === 0) return null;
  const maxCount = contentNumber(c, "maxCount", 4);
  const source = contentString(c, "source");

  return {
    type: "tabs" as const,
    ...headingOf(c),
    cta: ctaOf(c),
    tabs: tabs.map((tab) => {
      const slug = tab.categorySlug ?? "";
      const pool = source
        ? input.flaggedCategoryRails[source as HomepageProductSource]?.[slug]
        : input.categoryRails[slug];
      return {
        label: tab.label || tab.categorySlug || "",
        /*
          A tab on the website is a switch, not a link — and its slug may name
          an occasion or a collection rather than a category, so no address
          can be built for it honestly. The band's own view-all is `cta`.
        */
        href: null,
        // A tab with nothing in it stays: the website says "Nothing here yet."
        productSlugs: slugsOf(pool, maxCount),
      };
    }),
  };
}

/** RecentlyViewedSection — the app fills it from its own history. */
function recentlyViewedOf(section: HomepageSectionInstance) {
  const c = section.content;
  return {
    type: "recently-viewed" as const,
    ...headingOf(c),
    cta: ctaOf(c),
    maxCount: Math.min(RECENTLY_VIEWED_MAX, contentNumber(c, "maxCount", RECENTLY_VIEWED_MAX)),
  };
}

type Mapped = Omit<StorefrontHomeSection, "id" | "background"> | null;

/**
 * One band, or null when the website would draw nothing for it — or when it
 * is a band the app has no shape for (testimonials, FAQ, offers, blog cards,
 * why-us, and anything this file has never heard of).
 */
export function storefrontSectionOf(
  section: HomepageSectionInstance,
  input: StorefrontHomeInput,
): StorefrontHomeSection | null {
  const source = RAIL_SOURCES[section.type];
  let mapped: Mapped;
  if (source) {
    mapped = productRowOf(section, input.rails[source]);
  } else {
    switch (section.type) {
      case "hero":
        mapped = heroOf(section, input);
        break;
      case "shop-promises":
        mapped = promisesOf(section, input);
        break;
      case "our-menu":
        mapped = ourMenuOf(section, input);
        break;
      case "category-price-cards":
        mapped = priceCardsOf(section, input);
        break;
      case "same-day-countdown":
        mapped = countdownOf(section, input);
        break;
      case "banner-grid":
        mapped = bannerGridOf(section);
        break;
      case "tile-grid":
        mapped = tileGridOf(section);
        break;
      case "banner-strip":
        mapped = bannerStripOf(section);
        break;
      case "category-rail":
        mapped = productRowOf(
          section,
          input.categoryRails[contentString(section.content, "categorySlug")],
        );
        break;
      case "tabbed-rail":
        mapped = tabbedRailOf(section, input);
        break;
      case "recently-viewed":
        mapped = recentlyViewedOf(section);
        break;
      default:
        mapped = null;
    }
  }
  if (!mapped) return null;
  return {
    id: section.instanceId,
    background: section.background,
    ...mapped,
  } as StorefrontHomeSection;
}

/**
 * The homepage the app draws: the PUBLISHED snapshot, never the draft —
 * drafts carry campaigns that have not launched — in the website's order,
 * with the website's hidden and empty bands left out.
 */
export function storefrontHomeFrom(
  state: { published: HomepageBuilderSnapshot },
  input: StorefrontHomeInput,
): StorefrontHome {
  const { published } = state;
  return {
    updatedAt: published.updatedAt,
    sections: homepageSectionsToRender(published.sections ?? []).flatMap((section) => {
      const mapped = storefrontSectionOf(section, input);
      return mapped ? [mapped] : [];
    }),
    menu: input.menu,
  };
}
