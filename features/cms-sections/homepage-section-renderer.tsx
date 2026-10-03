"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Clock,
  Heart,
  Quote,
  Tag,
  Truck,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { SectionHeader, sectionHeaderDraws } from "@/components/shared/section-header";
import { RatingStars } from "@/components/shared/rating-stars";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  LandingCategory,
  LandingOffer,
  LandingProduct,
} from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import {
  countdownCells,
  countdownParts,
} from "@/features/orders/lib/delivery-date";
import type { Banner } from "@/types/media";
import {
  parseHeroSlides,
  parseListField,
  BANNER_STRIP_MAX,
  renderableRows,
  rowFlag,
} from "@/constants/section-registry";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";
import {
  getStorefrontFaqs,
  getStorefrontTestimonials,
  selectStorefrontFaqs,
  selectStorefrontTestimonials,
} from "@/features/content/lib/storefront-content";
import {
  getHomepageProducts,
  type HomepageProductSource,
  getHomepageCategories,
  getHomepageOffers,
} from "@/features/products/lib/homepage-catalog";
import { layoutSpacing } from "@/constants/spacing";
import { heroCopySideOf, heroSlidesFor, sectionAlignOf } from "./lib/section-utils";
import {
  RECENTLY_VIEWED_MAX,
  RECENTLY_VIEWED_UPDATED_EVENT,
  getRecentlyViewedProducts,
} from "@/features/products/lib/recently-viewed";
import type { HomepageSectionInstance, SectionBackground, SectionAlign
} from "@/types/homepage-builder";
import type { FaqItem, Testimonial } from "@/types/content";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatCurrency } from "@/utils/format";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { useSameDayCountdown } from "@/hooks/use-same-day-countdown";

export interface HomepageSectionRendererProps {
  section: HomepageSectionInstance;
  /**
   * Product rails built on the server. When absent (admin builder preview) the
   * renderer falls back to the browser catalogue.
   */
  rails?: Partial<Record<HomepageProductSource, LandingProduct[]>>;
  /**
   * A row per category the shop has, keyed by SLUG.
   *
   * Absent in the builder preview for the same reason `rails` is, and with
   * the same consequence: an empty row rather than a wrong one. There is no
   * browser-side fallback here because there is nothing generic to fall back
   * to — the slug is whatever the shop named a category, and guessing at it
   * from the demo catalogue is what this whole prop exists to stop.
   */
  categoryRails?: Record<string, LandingProduct[]>;
  /**
   * The cheapest live product in each category, keyed by SLUG.
   *
   * Not derived from `categoryRails`, deliberately. A rail is capped at
   * ROW_CAP and ordered by curation, so the cheapest thing IN one is the
   * cheapest of the first twelve — the true minimum today only because no
   * category here has twelve products yet. This is computed over the whole
   * category, with the same membership rule the collection page uses, so a
   * card's "Starting from" is a statement about the page it links to.
   *
   * Absent in the builder preview, like the rails, and with the same
   * consequence: no price rather than a wrong one.
   */
  categoryStartingPrices?: Record<string, number>;
  /**
   * The flagged rows cut by category — "the bestsellers that are cakes".
   *
   * A tabbed row can be about a FLAG and a CATEGORY at once, and neither of
   * the two rails above can answer that: one knows nothing about categories
   * and the other nothing about the flag. Computed on the server, because a
   * card carries `badge` rather than the flags and `badge` has a precedence
   * — featured beats bestseller — so filtering on it in the browser would
   * drop a featured bestseller out of the bestsellers tab.
   *
   * Absent in the builder preview, like the rails, with the same
   * consequence: the tab says it is empty rather than showing the wrong row.
   */
  flaggedCategoryRails?: Partial<
    Record<HomepageProductSource, Record<string, LandingProduct[]>>
  >;
  /**
   * Active hero banners read on the server. When absent (admin builder preview)
   * the promo section falls back to the browser banner store.
   */
  banners?: Banner[];
  /**
   * Categories read on the server. When absent (admin builder preview) the
   * category sections fall back to the browser catalogue.
   */
  categories?: LandingCategory[];
  /**
   * EVERY category, for the bands a shop has picked by hand.
   *
   * `categories` is the automatic row — pictureless ones dropped, the rest
   * capped at twelve. A picked one has to render whether or not it carries
   * a picture and wherever it sits in the catalogue, or a shop picks a
   * category and nothing appears.
   */
  categoryChoices?: LandingCategory[];
  /**
   * The shop's published cards, for the band that draws what this browser
   * has looked at. Those are slugs in localStorage and nothing else.
   */
  catalog?: LandingProduct[];
  /** Raw testimonials + faq read on the server (absent in the builder preview). */
  testimonials?: Testimonial[];
  faqs?: FaqItem[];
  /**
   * The shop's live coupons as offer cards, read on the server. When absent
   * (admin builder preview) the offers section falls back to the browser coupon
   * cache. It never falls back to the hardcoded demo offers — see
   * features/commerce/lib/coupon-offers.ts for why.
   */
  offers?: LandingOffer[];
  /**
   * The shop's real address, phone and hours from Settings → Contact, read on
   * the server. Absent in the builder preview, where the locator says so rather
   * than inventing outlets.
   */
  storeLocation?: {
    address: string;
    phone: string;
    mapUrl: string;
    hours: { day: string; hours: string }[];
  } | null;
  /**
   * The shop's Instagram from Settings → Social, read on the server. Absent in
   * the admin builder preview, where the section falls back to its own content.
   */
  instagram?: { url: string; handle: string } | null;
  /**
   * The shop's own rating, delivery speed and free-delivery threshold, read on
   * the server.
   *
   * These were constants — "4.9 Rating · 2000+ reviews", "Same-Day Delivery",
   * "On orders over ₹999" — and every one of them is a figure this CMS already
   * stores, so each was a stale second copy of an answer the shop had already
   * given. Absent in the builder preview, where each tile shows its label with
   * no figure rather than inventing one.
   */
  trust?: {
    freeDeliveryThreshold: number;
    deliveryPromise: string;
    /**
     * `HH:MM` when same-day orders really close today, or "" — the countdown
     * band's only number.
     *
     * A HAND-WRITTEN COPY of the field on `StorefrontTrust`, like the three
     * beside it, and not an import: `domainStaysPure` forbids this file from
     * reaching into apps/website, where that interface lives. Nothing links
     * the two but the `{...data}` spread in store-home-content.tsx, so both
     * are edited together and tsc connects them at that call site.
     *
     * REQUIRED, so the server cannot forget to send it — but read defensively
     * at the one place that uses it, because this object also arrives as JSON
     * from /api/builders/homepage/preview-data and a response a browser
     * cached before this field existed comes without it.
     */
    sameDayCutoff: string;
    rating: { count: number; average: number } | null;
  } | null;
  selected?: boolean;
  onSelect?: () => void;
  interactive?: boolean;
  /** Render only the inner card (no full-width section wrapper) so it can share a row. */
  embedded?: boolean;
}

function contentString(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback = ""
): string {
  const value = content[key];
  return typeof value === "string" ? value : fallback;
}

function contentNumber(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback: number
): number {
  const value = content[key];
  return typeof value === "number" ? value : Number(value) || fallback;
}

function SectionShell({
  section,
  selected,
  onSelect,
  interactive,
  children,
  className,
  noReveal,
  fullBleed,
  panelClassName,
}: HomepageSectionRendererProps & {
  children: React.ReactNode;
  className?: string;
  noReveal?: boolean;
  /**
   * Skip the max-width container, so the band runs edge to edge.
   *
   * Expressed by DROPPING the wrapper rather than by a viewport-unit escape
   * (`w-screen`, `calc(50% - 50vw)`), and that choice is the whole point:
   *
   *  - `100vw` includes the scrollbar, so on any desktop page that scrolls a
   *    viewport-wide child is wider than the content box and the shop gets a
   *    horizontal scrollbar on its own homepage.
   *  - the admin builder PREVIEW mounts these renderers inside a 1024px-max
   *    panel, not the viewport, so a viewport-unit bleed is right on the live
   *    page and broken in the preview — the exact live-works-preview-doesn't
   *    split this file has been bitten by before.
   *
   * Without the wrapper the section simply fills its parent, which is the
   * page on the storefront and the panel in the preview. Correct in both,
   * with no units involved.
   */
  fullBleed?: boolean;
  /**
   * A layer for the PANEL, applied after its tone.
   *
   * For a gradient, a ring or a shadow over whichever background the shop has
   * chosen — never for a background of its own. `cn` is twMerge, so a `bg-*`
   * here would outrank the tone and leave the Background dropdown doing
   * nothing, which is the bug three sections in this file already shipped
   * once. A gradient composes instead of replacing: `bg-[linear-gradient(...)]`
   * sets `background-image`, and the tone's `background-color` still shows
   * through every transparent stop.
   *
   * Ignored unless the background is a `panel-*` tone, because there is no
   * panel otherwise.
   */
  panelClassName?: string;
}) {
  /**
   * The Background setting, and the ONLY place a section background is decided.
   *
   * This is applied before the caller's `className`, so any `bg-*` or
   * `surface-*` a section passes there outranks it — and three sections did,
   * which meant their Background dropdown was inert. The Wedding Collection
   * section showed "White" in the builder while rendering cream, on the page and
   * in the preview, and changing the dropdown did nothing.
   *
   * A section may override its PADDING here. It may not override its background.
   */
  /**
   * A CARD, not a stripe.
   *
   * `panel` leaves the band white and tints a rounded box inside the page's
   * column instead. `fullBleed` wins, because a band that has asked to run to
   * both edges of the window cannot also be inset from them — the hero is the
   * only caller and a panel there would be a picture with a frame round it.
   */
  const panel = section.background.startsWith("panel") && !fullBleed;
  /*
    `Partial`, because the map is keyed on the four TONES and the setting can
    also be white, cream or plain `panel`. Typed as a full Record it does not
    compile; typed as a loose object it would silently accept a tone nobody
    has declared a colour for.
  */
  const PANEL_TONES: Partial<Record<SectionBackground, string>> = {
    "panel-rose": "bg-band-rose",
    "panel-mint": "bg-band-mint",
    "panel-sand": "bg-band-sand",
    "panel-sky": "bg-band-sky",
  };
  const panelTone = PANEL_TONES[section.background] ?? "bg-cream-200";
  /*
    THE BAND THAT IS NOT TINTED IS THE PAGE ITSELF.

    `bg-white` was a Tailwind literal, not a token — so the majority of
    the homepage's height was a colour no shop setting could reach. 16 of
    the 25 section types default to this branch.
  */
  const bgClass =
    section.background === "cream" ? "surface-cream" : "bg-background";
  // Hero runs its own entrance; the builder preview must stay fully visible while editing.
  // noReveal: the section reveals its own parts (e.g. staggered card grids).
  const revealOnScroll = !interactive && section.type !== "hero" && !noReveal;

  return (
    <section
      data-section-id={section.instanceId}
      onClick={interactive ? onSelect : undefined}
      className={cn(
        "scroll-mt-4 border-2 border-transparent",
        bgClass,
        layoutSpacing.bandY,
        /*
          A 2px TRANSPARENT BORDER IS STILL 2px OF PAGE.

          It exists so the builder's hover and selection outlines can appear
          without the section jumping. That is worth 4px inside the builder.
          It is worth nothing at all on the live storefront, where no band
          can be hovered or selected and the reserved frame is simply four
          more pixels of height on every one of the twenty bands — plus 4px
          added to the white between each pair of them, on a page the shop
          has now asked three times to draw closer together.

          It used to drop on full-bleed live bands only, because there the
          2px showed as a white margin down each side of a picture meant to
          touch both edges. That was the visible half of the same problem.

          So: the whole live page loses it, and `interactive` — which is the
          builder, and only the builder — keeps it. A section that cannot be
          outlined cannot be selected.
        */
        !interactive && "border-0",
        interactive && "cursor-pointer",
        selected && "border-bakery-500 ring-2 ring-bakery-200",
        className
      )}
    >
      {fullBleed ? (
        revealOnScroll ? (
          <ScrollReveal>{children}</ScrollReveal>
        ) : (
          children
        )
      ) : (
        <div className={layoutSpacing.container}>
          {panel ? (
            <div
              className={cn("rounded-2xl px-4 py-6 sm:px-6 sm:py-8", panelTone, panelClassName)}
            >
              {revealOnScroll ? <ScrollReveal>{children}</ScrollReveal> : children}
            </div>
          ) : revealOnScroll ? (
            <ScrollReveal>{children}</ScrollReveal>
          ) : (
            children
          )}
        </div>
      )}
    </section>
  );
}

/**
 * The trust bar, with its two figures taken from the shop.
 *
 * It read "Free Delivery · On orders over ₹999" and "Same-Day Delivery · Order
 * today, get today" as constants. The threshold is `freeDeliveryThreshold` and
 * the speed is `deliveryLeadDays`, both stored — and on this shop the second
 * was simply false: lead days is 1, so it cannot deliver same-day. The ₹999
 * happened to match today's setting, which is worse, not better: it would have
 * gone on saying ₹999 the moment an admin changed it.
 *
 * "Since 1956" is a claim with nothing behind it — and it disagreed with the
 * "Since 1965" in the hero badge a few hundred pixels above. It goes; the tile
 * keeps its title.
 */
function heroTrustBarFor(
  trust: HomepageSectionRendererProps["trust"],
): { icon?: string; title?: string; subtitle?: string }[] {
  /**
   * NOTHING rather than a placeholder, when the shop cannot be read.
   *
   * It returned a tile titled "Delivery" with an empty line under it and a
   * "Free Delivery" with no threshold — two tiles that assert a service on a
   * page that has just failed to find out whether the shop offers it. The
   * builder preview takes this path on every render.
   */
  if (trust == null) return [];

  /*
    THE TWO THAT WERE CLAIMS ARE GONE.

    "100% Quality / Premium ingredients" and "Made with Love" sat here as
    literals, asserted on behalf of whichever shop runs this CMS, about goods
    it may not make, with no box anywhere to edit or remove them. The two
    below survive because they are not claims: both are read from the shop's
    own commerce settings, and they are also the only place on the homepage
    that states either figure.
  */
  return [
    {
      icon: "Truck",
      title: "Free Delivery",
      subtitle:
        trust.freeDeliveryThreshold > 0
          ? `On orders over ${formatCurrency(trust.freeDeliveryThreshold)}`
          : "On every order",
    },
    { icon: "Clock", title: trust.deliveryPromise, subtitle: "" },
  ];
}

const heroTrustIcons = { Truck, Clock, BadgeCheck, Heart } as const;

/**
 * THE WAY IN, on the heading line of every row that has one.
 *
 * Small, upper-case and solid rather than an outlined button with an arrow:
 * at the end of a heading it reads as a label for the row rather than as a
 * second call to action competing with the cards under it. One component so
 * the product rails, the tabbed rails and the blog row cannot drift apart.
 */
/**
 * The tint a view-all pill takes on each band.
 *
 * Measured off the layout this follows: its pink band carries a pink
 * button, its cream band a yellow one, its two blue bands blue ones. The
 * rule holds in all four, and a neutral pill on a tinted band is the one
 * thing none of them does — on a tinted ground the pale grey it used to
 * wear reads as a disabled control rather than the way in.
 *
 * A white or cream band keeps that grey, which is what the same layout does
 * over its own untinted rows.
 */
const VIEW_ALL_TONES: Partial<Record<SectionBackground, string>> = {
  "panel-rose": "bg-band-rose-strong",
  "panel-mint": "bg-band-mint-strong",
  "panel-sand": "bg-band-sand-strong",
  "panel-sky": "bg-band-sky-strong",
};

function ViewAllLink({
  href,
  label,
  on,
}: {
  href: string;
  label: string;
  /** The band it sits on, so it can take that band's colour. */
  on?: SectionBackground;
}) {
  if (!href || !label) return null;
  return (
    <Link
      href={href}
      /*
        `min-h-9` is a thumb, not a look. Measured at 390px it came out 90x31,
        and a 31px target is under every guideline there is — the padding
        alone could not reach 36 because the label is 12px type. The height is
        set and the text centred in it rather than the padding being grown,
        so the pill does not get taller on the desktop rows where it is fine.
      */
      className={cn(
        "flex min-h-9 shrink-0 items-center rounded-md px-3.5 text-xs font-semibold tracking-wider text-foreground uppercase",
        (on && VIEW_ALL_TONES[on]) ?? "bg-cream-200",
      )}
    >
      {label}
    </Link>
  );
}

function HeroSection(props: HomepageSectionRendererProps) {
  const labels = useBusinessLabels();
  const { section } = props;

  const copySide = heroCopySideOf(section.content);

  const slides: HeroSlide[] = heroSlidesFor(
    parseHeroSlides(section.content).map((slide) => ({
      badge: slide.badge?.trim() || undefined,
      headline: slide.headline ?? "",
      subtext: slide.subtext?.trim() || undefined,
      primaryLabel: slide.primaryLabel?.trim() || `Shop ${labels.productWordPlural}`,
      primaryHref: slide.primaryHref?.trim() || routes.store.collections,
      secondaryLabel: slide.secondaryLabel?.trim() || undefined,
      secondaryHref: slide.secondaryHref?.trim() || undefined,
      imageUrl: slide.imageUrl ?? "",
      imageAlt: slide.imageAlt,
      mobileImageUrl: slide.mobileImageUrl,
    })),
  );

  const carousel = <HeroCarousel slides={slides} copySide={copySide} />;

  /*
    Two layouts, one component — branched HERE rather than dispatched from the
    switch below.

    `builder-list-field-round-trip` resolves the hero's renderer by finding the
    switch arm for this section type, reading the first capitalised tag after
    it, and scanning THAT component's body for every list field the hero
    declares. A ternary up in the switch returning a second component would
    pass the eye and fail the guard — and the guard would be right: half the
    hero's fields would then be read somewhere it never looks.

    The arm is described rather than quoted, because the guard finds its marker
    with a plain indexOf and a quoted copy up here is the earlier hit. Not
    hypothetical: this comment did exactly that, and the suite caught it.
  */
  /**
   * A HERO WITH NOTHING IN IT IS NOT A BAND.
   *
   * Every slide that has no picture is dropped, and a shop writing its words
   * BEFORE uploading wide artwork is the ordinary order of events — so zero
   * slides is a real state, not a corner. With the padding cancelled below it
   * would draw as a 4px line of nothing across the top of the homepage.
   *
   * The builder says so instead of vanishing, the way every other empty
   * section in this file does.
   */
  if (slides.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8">
          {/* A hero slide IS its picture, so a slide with no image is not a
              slide yet. Say that, rather than leaving an empty band. */}
          A hero slide is its picture — add an image to a slide and it will
          appear here.
        </div>
      </SectionShell>
    );
  }

  return (
    /*
      NO TOP PADDING, A FLOOR AT THE BOTTOM.

      The band is meant to start where the header ends, which is the whole
      point of it. `py-0` alone did not get there: the shell's own
      `py-16 sm:py-20 lg:py-24` is three classes, and tailwind-merge only
      resolves the one at the same breakpoint — so `py-0` cancelled the
      base and left 80px at sm and 96px at lg, a white gap above the
      picture at exactly the widths the layout is for.

      The bottom is not zero, because the dots and the promises strip now
      sit under the picture rather than over it, and at zero they would be
      flush against whatever band comes next.
    */
    <SectionShell
      {...props}
      /*
        ENOUGH TO CLEAR THE DOTS, and no more.

        This was 32/40/56px, and the band below brings its own top padding —
        so the two stacked into 186px of white between the banner and the
        first row of the page, measured at every width from 390 to 1900. The
        floor here exists because the dots and the promises strip sit under
        the picture rather than over it; it is not the page's own rhythm,
        and paying for that rhythm twice is what made the hero look adrift.
      */
      className="py-0 pb-4 sm:py-0 sm:pb-5 lg:py-0 lg:pb-6"
      fullBleed
    >
      {carousel}
    </SectionShell>
  );
}

/**
 * WHICH CATEGORIES A BAND SHOWS, AND IN WHAT ORDER.
 *
 * With nothing picked this is what it always was: the first `maxCount` of
 * the automatic row. The shop asked to choose instead, so a non-empty pick
 * list wins outright and `maxCount` stops applying — a shop that picks eight
 * with the box still reading six would otherwise lose two of its own choices
 * with nothing to explain it.
 *
 * A MAP, NOT A FILTER. This shop has two categories sharing the slug
 * `seasonal`; resolving a pick with `.filter(c => c.slug === slug)` draws it
 * twice, under the same React key.
 *
 * A PICK WHOSE CATEGORY IS GONE IS DROPPED. The alternative is a tile
 * captioned with a raw slug under a count of zero — a claim about a shop
 * that no longer sells the thing. The picker only ever offers live
 * categories, so this is the after-a-deletion case rather than the usual one.
 *
 * THE ROWS ARE READ BY THE BAND, not in here. A list parsed inside a helper
 * renders correctly and still fails the round-trip guard, and the guard is
 * right to insist: a band that does not name its own list is a band nobody
 * can see is reading one.
 */
function categoriesForBand(
  rows: ReturnType<typeof renderableRows>,
  props: HomepageSectionRendererProps,
  maxCount: number,
): LandingCategory[] {
  const picks = rows.filter((row) => String(row.categorySlug ?? "").trim());
  if (picks.length === 0) {
    return (props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount);
  }

  const bySlug = new Map<string, LandingCategory>();
  for (const category of props.categoryChoices ?? props.categories ?? []) {
    if (!bySlug.has(category.slug)) bySlug.set(category.slug, category);
  }

  return picks.flatMap((row) => {
    const found = bySlug.get(String(row.categorySlug ?? "").trim());
    if (!found) return [];
    const label = String(row.label ?? "").trim();
    const image = String(row.image ?? "").trim();
    return [{ ...found, name: label || found.name, image: image || found.image }];
  });
}

function OurMenuSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "center");
  const maxCount = contentNumber(c, "maxCount", 8);
  const picks = renderableRows(parseListField(c, "picks"));
  const items = categoriesForBand(picks, props, maxCount);

  if (items.length === 0) return null;

  return (
    /*
      THE OVERRIDE IS GONE, and that is what closed the gap under this strip.

      It set `py-8 sm:py-10 lg:py-12` because the shell's own rhythm was then
      `py-16 sm:py-20 lg:py-24` — 96px top and bottom, which floated a strip
      of links half a screen from the hero it belongs under.

      The shell is `bandY` now, and tighter than the override ever was. So
      the override had quietly become the loosest band on the page: the exact
      opposite of the thing it was written to fix, and the gap the shop
      pointed at. A band that wants the page's rhythm should not name one.
    */
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align={align}
      />
      <div
        className={cn(
          /*
            A ROW THAT SCROLLS ON A PHONE, a grid above it — and the gutter
            negated so the scroll runs to the edge of the screen instead of
            stopping 16px short, which is what tells a customer there is more
            to the right.

            NO TOP MARGIN. It had `mt-8`, which was the gap under the heading
            — except SectionHeader carries its own `mb-10` for that, so the
            two were stacked, and when the shop blanked the heading the
            margin stayed behind and held 32px of nothing above the tiles.
            Spacing under a heading belongs to the heading, which is the only
            thing that knows whether there is one.
          */
          "no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0",
          /*
            THE COLUMN COUNT FOLLOWS THE TILES. It was hard-wired to eight,
            so a shop with three categories got three cards and five columns
            of air. Whole class names rather than a style prop, because
            Tailwind only emits the classes it can see.
          */
          items.length <= 4 && "lg:grid-cols-4",
          items.length === 5 && "lg:grid-cols-5",
          items.length === 6 && "lg:grid-cols-6",
          items.length === 7 && "lg:grid-cols-7",
          items.length >= 8 && "lg:grid-cols-8"
        )}
      >
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            /*
              THE CARD IS THE WHOLE TILE, name included.

              The name used to sit outside the bordered box, under it — so
              the tile was a picture with a caption floating beneath rather
              than one object, and a two-line name pushed its neighbours out
              of alignment. Inside, the border encloses both and every tile
              is the same height whatever its name does.
            */
            /*
              A TINT, A HAIRLINE AND A LIFT — all three, measured.

              This started as `bg-gradient-to-b from-cream-50 to-white`, and
              `--cream-50` is literally #ffffff, so the gradient ran white to
              white and there was no tint at all. The fix for that swung the
              other way: cream-200 painted #f0eeea, a grey-beige slab against
              a white band, and dropped the border on the reasoning that a
              tint and an edge were two ways of saying the same thing.

              They are not. Held next to the layout this is drawn from, the
              tile there is a near-white panel with a hairline round it and a
              shadow barely a pixel deep — the tint gives a cut-out product
              something to sit on, the hairline says where the tile stops
              against a white page, and the shadow is what lifts it off one.
              Take any of the three away and it reads as a different object:
              without the tint a cut-out floats in a void, without the
              hairline the panel dissolves, without the lift it is a hole in
              the page rather than a card on it.

              cream-100 (#faf8f4) is the lightest tint the palette has that is
              still a tint. shadow-xs is 4% at one pixel.

              THE INSET IS GONE. It was 8px, 12px from `sm`, and it made the
              tint a frame around the picture. The shop asked for the
              picture to fill the card the way an ecommerce card does, and
              said so about all three bands at once.

              So the tint stops framing and becomes a backdrop — what shows
              through a picture with no background of its own, and what
              fills the card while one loads. `overflow-hidden` moves HERE:
              with no padding, the picture reaches the card's own corners,
              and without it the square would square them off.
            */
            className="group flex w-[5.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border/70 bg-cream-100 shadow-xs sm:w-auto"
          >
            {/*
              A SQUARE, not a circle.

              A circle crops a product photograph to its middle — a bouquet
              loses its stems, a boxed gift loses its corners — and the strip
              this is drawn from is squares for exactly that reason.

              NO RADIUS OF ITS OWN any more. It had `rounded-xl` because it
              was inset and had to round itself; now the card clips, and two
              radii on top of each other is how you get a rounded square
              floating inside a rounder one.
            */}
            <div className="relative aspect-square w-full bg-cream-100">
              {category.image ? (
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover"
                  /*
                    120px was only ever right in the eight-across case. At a
                    1023px viewport the four-column grid paints these at about
                    225px, so the browser was asked for a source under half
                    the painted width and every tablet got soft tiles.
                  */
                  sizes="(min-width: 1024px) 160px, (min-width: 640px) 25vw, 88px"
                />
              ) : null}
            </div>
            {/*
              ITS OWN PADDING, because the card no longer has any. This read
              `px-1 pt-2.5 pb-1` and leaned on the card's 8/12px for the rest
              — with that gone the name would have touched three edges.
            */}
            <p className="line-clamp-2 px-2 pt-2.5 pb-3 text-center text-[13px] font-semibold text-foreground sm:text-sm">
              {category.name}
            </p>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

/**
 * The rows that select on a CATEGORY rather than on a flag set per product.
 *
 * Only used to word the empty-row hint below — the selection itself lives in
 * `homepage-rails.ts`, and this is deliberately a list of section types rather
 * than an import from there, because the two unions are not the same thing.
 */
const CATEGORY_ROWS: ReadonlySet<string> = new Set(["eggless", "seasonal"]);

function ProductGridSection(
  props: HomepageSectionRendererProps & {
    cakes: LandingProduct[];
    showCta?: boolean;
  }
) {
  const c = props.section.content;
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "left");
  const labels = useBusinessLabels();
  const maxCount = contentNumber(c, "maxCount", 4);
  const ctaHref = contentString(c, "ctaHref");
  const ctaLabel = contentString(c, "ctaLabel");
  const cakes = props.cakes.slice(0, maxCount);

  /**
   * Nothing to show means nothing to show — the same answer this file already
   * gives for categories, why-us and the store locator. A shop with no cake
   * flagged for this row was publishing "Our Best Sellers" over an empty strip.
   *
   * The builder says WHY instead of vanishing, because a section that renders
   * nothing cannot be selected, and an admin cannot fix what they cannot click.
   */
  if (cakes.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          align={align}
        />
        {/*
          The advice has to match how the row actually chooses.

          It said "Flag some cakes under Products" for every row, and for two of
          them there is no longer a flag to set: Eggless and Seasonal select on
          the CATEGORY now, which is what the nav links and the collection pages
          read. An admin following this could look for a tick that does not
          exist and conclude the builder was broken.
        */}
        <div className={cn(hasHeading && "mt-8", "rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8")}>
          {CATEGORY_ROWS.has(props.section.type) ? (
            <>
              Nothing is filed under this category yet, so the row stays hidden
              on the live homepage. Set the category on a product under
              Products, or lower &ldquo;Max {labels.productWordPlural.toLowerCase()}{" "}
              shown&rdquo;.
            </>
          ) : (
            <>
              {/* The shop's own noun, twice — this panel is read by whoever
                  runs the shop, and it told a florist to flag some cakes. */}
              No {labels.productWord.toLowerCase()} is set for this row yet, so it
              stays hidden on the live homepage. Flag some{" "}
              {labels.productWordPlural.toLowerCase()} under Products, or lower{" "}
              &ldquo;Max {labels.productWordPlural.toLowerCase()} shown&rdquo;.
            </>
          )}
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props} noReveal>
      {/*
        THE HEADING RANGES LEFT AND THE LINK SITS OPPOSITE IT.

        It was a centred heading with a spacer either side, and on a phone a
        centred button under the grid — so a customer who had read the
        heading and wanted more of THAT scrolled past four products to find
        the way in. The layout this follows puts the two ends of the line to
        work: what the row is on the left, the way in on the right, at every
        width.

        It is also the shape the tabbed rail already had, so seven product
        rows and that one stop being two different bands wearing the same
        cards.
      */}
      <ScrollReveal>
        <SectionHeadingRow
          align={align}
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          className="items-center"
          trailing={
            props.showCta ? (
              <ViewAllLink href={ctaHref} label={ctaLabel} on={props.section.background} />
            ) : null
          }
        />
      </ScrollReveal>
      {/*
        THE ROW SCROLLS, with the arrow the layout puts on it — and the arrow
        only appears when there is somewhere to go, which for a row of four
        in a space that fits four is nowhere. Same component as the tabbed
        rail, so the two behave identically.
      */}
      <div className="mt-6">
        <ScrollStrip>
          {cakes.map((cake) => (
            <ProductCard
              key={cake.id}
              cake={cake}
              className="h-auto w-[calc((100%-1rem)/1.6)] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]"
              showWishlist={false}
            />
          ))}
        </ScrollStrip>
      </div>
    </SectionShell>
  );
}


/**
 * The shop's own promo cards — image, words, its own button.
 *
 * Every card is the SECTION's content, not the shared hero-banner pool, so
 * two promo bands on one page can differ and each card can carry its own
 * line and its own link. That is what the reference's Must Have collage, its
 * Personalised band, its Him/Her split and its city banner all are.
 *
 * An empty list renders NOTHING — a heading over no cards is worse than no
 * band, the same rule every other list-driven section here follows.
 */
/**
 * ONE HEADING, SEVERAL TABS, ONE GRID.
 *
 * Three product rows down a long page are three scrolls apart. Tabbed, they
 * are one band and a click.
 *
 * Each tab names a CATEGORY the shop has, so the rows come from the same
 * `categoryRails` the open category row uses — one answer to "what is in
 * this category", not a second one that can drift.
 */
/**
 * A HEADING WITH A CONTROL BESIDE IT, at whichever edge the shop chose.
 *
 * WHY THIS IS NOT JUST A CLASS ON THE HEADING. `SectionHeader` centres with
 * `mx-auto text-center`, and neither does anything to a flex child that hugs
 * its own text — which is what the heading is in every row that carries a
 * view-all pill. Measured: at 1280 the product rows' heading is 178px wide in
 * a 1216px band, so `text-center` centres text inside a 178px box and moves
 * nothing. A setting that appears to do nothing is worse than no setting.
 *
 * So the ROW changes shape instead, and the three shapes are these:
 *
 *   left / right — the heading takes the free space (`flex-1`) and its own
 *     text-align puts the words at one end of it. The pill stays where it
 *     was. For `left` this is pixel-identical to the two-item row that was
 *     here before: `justify-between` already put a hugging heading at the
 *     start.
 *
 *   centre — a MIRROR of the pill's box goes in front of the heading, so the
 *     heading is centred on the BAND rather than on the space left over
 *     beside the pill. Without it a centred heading sits half the pill's
 *     width to the left of true centre, and only when the shop has filled
 *     the view-all link in — the same section would centre correctly with
 *     the link blank, which is not a difference anyone could attribute.
 *
 * The centre shape is not invented here: it is exactly what the blog row was
 * already built from, which is the one band on this page that centres a
 * heading over a pill today.
 */
function SectionHeadingRow({
  align,
  overline,
  title,
  trailing,
  className,
  headerClassName,
  trailingClassName,
}: {
  align: SectionAlign;
  overline?: string;
  title: string;
  trailing?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  trailingClassName?: string;
}) {
  const centred = align === "center";
  return (
    <div className={cn("flex justify-between gap-4", className)}>
      {centred ? <div className="hidden flex-1 sm:block" aria-hidden="true" /> : null}
      <SectionHeader
        overline={overline}
        title={title}
        align={align}
        className={cn("mb-0 min-w-0", !centred && "flex-1", headerClassName)}
      />
      {/*
        THE MIRROR IS DRAWN EVEN WHEN THERE IS NOTHING TO PUT IN IT.

        Centring here is two equal boxes either side of a heading that hugs
        its text. With no trailing control the second box was skipped, which
        left `justify-between` with a grown spacer and a hugging heading — and
        `justify-between` puts the last item at the END. Measured on the
        tabbed rail: centre and right both landed the heading at 1082..1224,
        the same place, and centre was silently right.
      */}
      {centred || trailing ? (
        <div
          className={cn(
            "flex justify-end",
            centred ? "flex-1" : "shrink-0",
            trailingClassName,
          )}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
/**
 * A ROW THAT SCROLLS. The arrows are the exception, not the way through.
 *
 * TWO CONDITIONS, and both have to hold. The strip has to actually
 * overflow — a row of four in a space that fits four has nowhere to go,
 * and a pair of dead chevrons either side of it is a control that lies
 * about what it does. And the window has to be wider than a laptop.
 *
 * The second one is the shop's decision and it is worth writing down what
 * it costs, because measuring the page first made it look like the
 * opposite of what it is. At 390px twelve rows on the homepage overflow;
 * from 1024px up exactly one does, by about 300px. So these arrows live
 * almost entirely on phones and tablets, which is the one place they are
 * least use: a finger already drags the row, and the chevrons sit on top
 * of the cards to say so.
 *
 * WHAT IT COSTS is that one row, below 1400, driven by a mouse. There is
 * no arrow and no visible bar there, and a wheel scrolls a page down
 * rather than a row sideways — so a trackpad or a touchscreen reaches the
 * fifth card and a plain mouse does not. It is one row and about half a
 * card; hijacking the wheel to fix it would take the page's own scrolling
 * away from everybody, which is the worse trade.
 */
function ScrollStrip({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState({ back: false, forward: false });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px of slack: sub-pixel widths make an exactly-fitting row report a
    // scrollWidth a fraction larger than its client width.
    setCanScroll({
      back: el.scrollLeft > 1,
      forward: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, children]);

  const step = (direction: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    // A little under a full screen, so the card at the edge stays in view
    // and a customer does not lose their place.
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  /*
    INSIDE THE STRIP, not straddling its edge.

    They sat at `left-0 -translate-x-1/2`, half outside — which is how the
    layout draws them, and which on a phone pushed 2px past the window on
    five rows at once and gave the whole page a horizontal scrollbar.
    Measured at 360, 390 and 430: scrollWidth 2px over the viewport.

    A carousel arrow overlapping the first card is ordinary; a page that
    slides sideways is not.
  */
  /*
    1400, AND IT IS THE SHOP'S NUMBER — used here and on the hero, so the
    two sets of arrows appear and disappear together rather than the page
    growing controls in two stages.

    It does not line up with a Tailwind breakpoint on purpose. `xl` is
    1280, which is a small laptop and below the line the shop drew; `2xl`
    is 1536, and a 1920px laptop at the 125% scaling Windows ships by
    default reports exactly 1536 CSS pixels, so cutting there would put
    the arrows back on the commonest laptop of all. 1400 sits between the
    two.

    44px, not 36. A 36px circle over a card is a small target for a
    pointer and under the floor for anything else, and these now only
    appear on the screens with the most room for them.

    `hidden` and not `invisible` or `opacity-0`: the button has to leave
    the tab order too, or a keyboard reaches a control nobody can see.
  */
  const arrow =
    "absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md min-[1400px]:flex";

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 sm:gap-5"
      >
        {children}
      </div>
      {canScroll.back ? (
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Previous"
          className={cn(arrow, "left-1")}
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      {canScroll.forward ? (
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Next"
          className={cn(arrow, "right-1")}
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}
    </div>
  );
}

function TabbedRailSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "left");
  const declared = renderableRows(parseListField(c, "tabs")).filter((tab) =>
    Boolean(tab.categorySlug),
  );
  /*
    HOW MANY OF THEM TO DRAW.

    0 — and a missing value — means every tab, which is what this row did
    before the setting existed, so nothing already saved changes. A shop
    that wants three on the page and two more ready to swap in sets three
    here rather than deleting and retyping the other two.
  */
  const maxTabs = contentNumber(c, "maxTabs", 0);
  const tabs = maxTabs > 0 ? declared.slice(0, maxTabs) : declared;
  const maxCount = contentNumber(c, "maxCount", 4);
  /**
   * The tab INDEX, not its slug.
   *
   * A shop can legitimately point two tabs at one category — "Under ₹500"
   * and "Gifts" can both be Gifts while the labels differ — and keying by
   * slug would make clicking one light up the other.
   */
  const [active, setActive] = useState(0);
  const railCtaLabel = contentString(c, "ctaLabel");
  const railCtaHref = contentString(c, "ctaHref");
  /**
   * WHAT THE ROW IS ABOUT, beside what each tab is about.
   *
   * Blank means every product in the tab's category, which is what this row
   * has always been. Set to a flag and the row becomes "the bestsellers that
   * are cakes" — which is the only honest way for a row headed Bestsellers
   * to carry category tabs. Without it the heading is a claim about what
   * sells made over a listing that selects on something else entirely.
   */
  const source = contentString(c, "source");

  if (tabs.length === 0) return null;

  const current = tabs[Math.min(active, tabs.length - 1)];
  const slug = current.categorySlug ?? "";
  const pool = source
    ? (props.flaggedCategoryRails?.[source as HomepageProductSource]?.[slug] ?? [])
    : (props.categoryRails?.[slug] ?? []);
  const cakes = pool.slice(0, maxCount);

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        {/*
          THE HEADING, THE TABS AND THE LINK ON ONE LINE.

          They were stacked and centred, which on a band whose heading is
          blank left a row of tabs floating alone in the middle of an empty
          strip. The layout this follows puts the three side by side: what
          the row is, what it can be switched to, and the way in.

          The heading is ranged left, because a centred heading beside a
          left-hand row of tabs is neither.

          AND NOTHING WRAPS PAST THE RULE. It used to: on a phone the link
          dropped to a second line, which put the rule under the LINK instead
          of under the tabs, so the tabs floated again and the pointer
          pointed at nothing. Measured: on the rule at 1440 and 1920, off it
          at 390, 768 and 1024.

          Putting all three on one line fixed that and broke something else —
          at 390 the heading and the link left the tab strip 107px, so the
          first tab read "Birthday Ca". So the HEADING moves above the tabs
          on a phone and stands beside them from `sm`. The link stays where
          it is, at the bottom right, and the tabs keep the rest of the line.

          The strip scrolls rather than wrapping, which it was already built
          to do. `min-w-0` is what lets it shrink: without it a flex child
          refuses to go below its content width and pushes the link off the
          edge instead.
        */}
        {/*
          THE TABS STAND ON THE RULE. They do not float above it.

          The rule was a separate strip 16px below, so the tabs hung in the
          air over it and the pointer under the chosen one pointed at
          nothing. In the layout this follows they are FOLDER TABS: the rule
          is the row's own bottom edge, each tab's bottom sits on it, and the
          unchosen ones open into it — no line across their foot — so the
          rule reads as the front of the drawer they are pulled out of.

          `items-end` is what puts them there, and the heading and the link
          lift themselves off the line with their own padding rather than
          sitting on it too.
        */}
        {/*
          A HEADING THAT IS NOT RANGED LEFT LEAVES THE TAB GROUP.

          It has to. Inside the group the heading is a flex child beside the
          tab strip, so it hugs its own text — measured, setting this band to
          centre or to right moved the heading exactly 0px, both times. A
          dropdown that does nothing is worse than one not offered.

          Only when the shop has asked for it, so every tabbed rail already
          published — none of which carries this key — keeps the row it was
          published with, to the pixel.
        */}
        {align === "left" ? null : (
          <SectionHeadingRow
            align={align}
            overline={contentString(c, "overline")}
            title={contentString(c, "title")}
            className="mb-4"
          />
        )}
        {/*
          THE TAB STRIP GETS THE WHOLE LINE ON A PHONE.

          Measured at 390: the band's content is 325px and the VIEW ALL
          pill took x=265..357, leaving the scrolling strip 219px with the
          tabs clipped at a hard edge. Two of three tabs were cut in half.

          `flex-wrap` with the strip as the last line is all it takes. The
          border stays exactly where it is — the row's bottom edge is still
          directly under the tabs, so the folder-tab invariant above and
          the active tab's `-mb-px` are untouched.

          The inner wrapper is gone because the header and the strip have
          to be able to land on different lines; its `sm:gap-x-5` is folded
          in here, which also makes the two gaps on that line agree.

          `ml-auto` on the link rather than `justify-between`: the header
          renders nothing for a blank title, and with two children
          `justify-between` would then throw the pill to the left.
        */}
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 border-b border-border sm:flex-nowrap sm:gap-x-5 sm:gap-y-0">
            {align === "left" ? (
              <SectionHeader
                overline={contentString(c, "overline")}
                title={contentString(c, "title")}
                className="mb-0 shrink-0 pb-0 sm:pb-2.5"
                align="left"
              />
            ) : null}
            {/*
              The tabs scroll sideways rather than wrapping: four tabs on a
              phone wrap to two lines and move the grid down the page every
              time one is pressed.
            */}
            {/*
              BOXES, and the chosen one is filled.

              They were pale pills inside a pill, which on a tinted band left
              the chosen tab and the unchosen ones at almost the same weight.
              Filled-dark against outlined-white reads at a glance, and the
              little pointer under the chosen one ties it to the row below —
              which is the whole reason a tab is not just a filter chip.

              SIZED LIKE A CHOICE, not like a filter chip. The shop held the
              layout up beside this and the tabs there are the second-largest
              thing on the line after the heading — text at the body size,
              not the small one, and enough padding round it to be an obvious
              target on a phone.

              THE FILL IS NEUTRAL, not the brand. `--foreground` is the
              page's own ink, so the chosen tab is the same dark as the
              heading beside it whatever palette the shop picks — and on a
              tinted band a brand-coloured fill competes with the tint it
              sits on. The pointer takes the same colour, because it is the
              tab's own corner rather than a decoration.
            */}
            {/*
              `pb-2 -mb-2` is room for the pointer, not spacing.

              `overflow-x-auto` clips BOTH axes — a box that scrolls sideways
              cuts anything below it too — so the pointer hanging under the
              chosen tab simply disappeared. The padding gives it somewhere to
              be inside the clip and the negative margin puts the strip back
              where it was, so the tabs still stand on the rule.
            */}
            <div className="no-scrollbar order-last -mb-2 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-2 sm:order-none sm:w-auto">
              {tabs.map((tab, index) => (
                <button
                  key={`${tab.label}-${index}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-pressed={index === active}
                  className={cn(
                    /*
                      `-mb-px` pulls the tab down over the row's rule so its
                      own fill covers that one pixel — which is what makes an
                      unchosen tab open into the line instead of being boxed
                      off from it. Square at the foot for the same reason: a
                      rounded bottom corner leaves a notch of rule showing
                      through beside it.
                    */
                    "relative -mb-px shrink-0 rounded-t-md border px-5 py-2.5 text-base font-semibold",
                    index === active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border border-b-transparent bg-card text-foreground"
                  )}
                >
                  {tab.label || tab.categorySlug}
                  {index === active ? (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1.5 left-1/2 size-2.5 -translate-x-1/2 rotate-45 bg-foreground"
                    />
                  ) : null}
                </button>
              ))}
            </div>
          <div className="ml-auto shrink-0 pb-2.5">
            <ViewAllLink href={railCtaHref} label={railCtaLabel} on={props.section.background} />
          </div>
        </div>
      </ScrollReveal>

      {cakes.length === 0 ? (
        /*
          A tab whose category holds nothing says so, rather than collapsing
          the band — the tabs beside it still work, and a customer who
          pressed this one needs to know the press landed.
        */
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Nothing here yet.
        </p>
      ) : (
        <div className="mt-6">
          {/*
            FOUR ACROSS, and the fifth is off the edge.

            The card widths are a quarter of the strip minus its gaps, so a
            row of four looks exactly like the grid it replaces — and a row
            of nine scrolls. A fixed pixel width would leave a ragged half-card
            at most window sizes.
          */}
          <ScrollStrip>
            {cakes.map((cake) => (
              <ProductCard
                key={cake.id}
                cake={cake}
                className="h-auto w-[calc((100%-1rem)/1.6)] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]"
                showWishlist={false}
              />
            ))}
          </ScrollStrip>
        </div>
      )}
    </SectionShell>
  );
}

/**
 * A grid of labelled, linked picture tiles the shop writes itself.
 *
 * The reference uses this shape twice — sixteen "Gift Categories" tiles and
 * six country tiles under "International Gifts Delivery". Neither is a
 * catalogue category, which is why `CategoriesSection` cannot express them:
 * that one is driven by the taxonomy and can only point at a category page.
 */
/** A row of the shop's own articles. Empty is not a band. */
function BlogCardsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "center");
  const posts = renderableRows(parseListField(c, "posts"));
  const ctaHref = contentString(c, "ctaHref");
  const ctaLabel = contentString(c, "ctaLabel");

  if (posts.length === 0) return null;

  return (
    <SectionShell {...props}>
      {/*
        The link sits on the heading line, the same as every product row —
        and on this one the pill has always been desktop-only.
      */}
      <SectionHeadingRow
        align={align}
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        className="items-end"
        trailingClassName="hidden sm:flex"
        trailing={<ViewAllLink href={ctaHref} label={ctaLabel} on={props.section.background} />}
      />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {posts.map((post, index) => {
          const body = (
            <>
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <OptimizedImage
                  src={post.image ?? ""}
                  alt={post.title ?? ""}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                />
              </div>
              <div className="space-y-1.5 p-4">
                {post.meta ? (
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {post.meta}
                  </p>
                ) : null}
                {post.title ? (
                  <h3 className="font-heading text-sm font-semibold leading-snug">{post.title}</h3>
                ) : null}
                {post.excerpt ? (
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                ) : null}
              </div>
            </>
          );

          // Same resting lift as the product cards, so one page draws one card.
          const card =
            "group flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm";

          return post.href ? (
            <Link key={`${post.title}-${index}`} href={post.href} className={card}>
              {body}
            </Link>
          ) : (
            <article key={`${post.title}-${index}`} className={card}>
              {body}
            </article>
          );
        })}
      </div>
    </SectionShell>
  );
}

/**
 * A GRID OF FINISHED ARTWORK.
 *
 * Every other band on this page draws words over or under a picture. This
 * one does not: the shop exports banners with their own heading, strapline
 * and button baked in, so anything this file painted on top would be a
 * second heading over the first.
 *
 * FIFTEEN COLUMNS, which is the only number that does what the layout asks.
 * The arrangement is a row of three wide banners over a row of five narrow
 * ones — and 15 is the smallest grid both divide into: wide spans 5, narrow
 * spans 3. A 4- or 5-column grid cannot hold a row of three without leaving
 * a hole.
 */
/**
 * THE EVEN ROW: same width, same ratio, all the way across.
 *
 * The ratios are the band's own, not the picture's. A row of banners whose
 * artwork was exported at three different shapes is a row of three
 * different heights with the shop's background showing through the gaps —
 * so the band states one box per shape and the editor says what to export.
 *
 * The numbers come off the content column, which is 1520 at its widest:
 * two across a 20px gap is 750 each, three is 493. The height is the same
 * 290 either way, so a shop that switches between them is not re-exporting
 * its artwork to a new height as well as a new width.
 */
/**
 * WHERE EACH SHAPE SPLITS.
 *
 * ONE RULE, AND IT WAS MEASURED RATHER THAN CHOSEN: a step may never make
 * a card smaller than the one a phone already gets. Splitting a row in two
 * halves every card in it, so a split at the wrong width leaves somebody
 * on a bigger screen looking at a smaller banner.
 *
 * Both first drafts broke it, and neither looked wrong in a diff. The pair
 * split at `md`: at 768 its two banners came out 350x135 against a 390px
 * phone's 358x138. The trio kept `md` on the argument that one 1.7:1
 * banner across a tablet is 976x574 and most of the screen — a real point
 * about taste, and it lost to the same 350 against 358.
 *
 * So both wait for `lg`, and the trio takes its third column at `xl`.
 * Measured after: the smallest a banner ever gets is the phone's own, and
 * the smallest above that is 392.
 */
const BANNER_ROW = {
  "2": { grid: "grid-cols-1 lg:grid-cols-2", box: "aspect-[750/290]" },
  "3": { grid: "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3", box: "aspect-[493/290]" },
} as const;

function BannerGridSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "left");
  const banners = renderableRows(parseListField(c, "banners"));
  /*
    ONE COLUMN ON A PHONE, whichever shape the shop picked.

    Three 493px banners side by side on a 390px screen is 120px each, and
    the words in these pictures are pixels — there is no size at which a
    120px banner reads. Stacked, each one is the full width of the screen,
    which is LARGER than it gets on a desktop. Where each shape splits is
    a measured question; see BANNER_ROW.
  */
  const across = BANNER_ROW[contentString(c, "columns").trim() as keyof typeof BANNER_ROW];

  if (banners.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align={align}
      />
      <div
        className={cn(
          "grid gap-4 sm:gap-5",
          across ? across.grid : "grid-cols-2 lg:grid-cols-15",
        )}
      >
        {banners.map((banner, index) => {
          const wide = rowFlag(banner.wide);
          const box = cn(
            "relative block overflow-hidden rounded-2xl bg-muted",
            /*
              A RATIO EACH, so a row lines up whatever the shop exported.
              Without one the tallest picture sets the row height and the
              rest sit in a band of their own background.

              In the even row every card takes the same one and the card's
              own `wide` flag is ignored — it is the collage's control, and
              honouring it here would break the very evenness that was
              chosen. The editor's label says so.
            */
            across
              ? across.box
              : wide
                ? "aspect-[11/10] lg:col-span-5"
                : "aspect-[2/3] lg:col-span-3",
          );
          const picture = (
            <OptimizedImage
              fill
              className="object-cover"
              /*
                THE TWO TILE SHAPES ASK FOR DIFFERENT PICTURES, and one
                `sizes` for both would over-fetch for every narrow one. The
                grid is `lg:grid-cols-15` with the wide tile at `col-span-5`
                and the narrow at `col-span-3` — 34vw and 20vw of a 1376px
                column, which is the 445px and 259px measured on this shop.
                Below lg the grid is two across.
              */
              sizes={wide ? "(min-width: 1024px) 34vw, 50vw" : "(min-width: 1024px) 20vw, 50vw"}
              src={banner.image ?? ""}
              /*
                The words are pixels inside the picture, so the alt text is
                the only thing a screen reader has. Empty when the shop has
                not written one — an invented description of a picture nobody
                here has seen is worse than silence.
              */
              alt={banner.label ?? ""}
            />
          );

          return banner.href ? (
            <Link key={`${banner.image}-${index}`} href={banner.href} className={box}>
              {picture}
            </Link>
          ) : (
            <div key={`${banner.image}-${index}`} className={box}>
              {picture}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/** The four band tints, per card rather than per band. */
const CARD_TONES: Record<string, string> = {
  rose: "bg-band-rose",
  mint: "bg-band-mint",
  sand: "bg-band-sand",
  sky: "bg-band-sky",
  neutral: "bg-cream-200",
};

/**
 * THE CHEAPEST THING IN A CATEGORY, or nothing at all.
 *
 * This took the minimum over the category's RAIL, which is capped at
 * ROW_CAP (12) and ordered by curation — so it was the cheapest of the
 * first twelve, and the true minimum only for as long as no category has
 * twelve products in it. Nothing would have failed the day one did: the
 * card would simply have named a price that is not the lowest on the page
 * it links to.
 *
 * The server computes it over the whole category now, with the same
 * membership rule the collection page uses. `null` when the shop has
 * nothing priced in that category, and `null` in the builder preview,
 * where the map is absent by design — a card that says nothing about price
 * is honest, and one that says a price nobody can buy at is not.
 */
function startingPriceOf(price: number | undefined): number | null {
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

function CategoryPriceCardsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "center");
  const items = renderableRows(parseListField(c, "items"));

  if (items.length === 0) return null;

  /*
    The shop's own categories, for the NAME on each card. Typing it again
    into the row would be a second copy that stops agreeing with the
    catalogue the moment a category is renamed — so the row holds a slug,
    and `label` is only there for a shop that wants the card to read
    differently from the category itself.
  */
  const categories = props.categories ?? getHomepageCategories(24);
  const nameOf = new Map(categories.map((category) => [category.slug, category.name]));
  const priceLabel = contentString(c, "priceLabel") || "Starting from";
  /*
    IS THERE A HEADING AT ALL? The link's placement depends on it.

    `SectionHeader` draws nothing for a blank one — which is the SHIPPED
    state, and what a second copy of this row looks like until the shop
    writes its own. With nothing in it the wrapper collapsed to 0px and the
    link, positioned against it, landed on top of the cards. Measured: the
    row with a heading had a 32px header box and the one without had none.
  */
  const hasHeading = Boolean(
    contentString(c, "overline").trim() || contentString(c, "title").trim(),
  );

  return (
    <SectionShell {...props}>
      {/*
        A CENTRED HEADING WITH THE LINK PINNED BESIDE IT.

        Centring the header and floating the link is what the layout does,
        and it only works while the link is out of the flow — inside it, the
        heading centres on the space LEFT OVER and sits visibly off-centre.
        Absolute from `sm` up, and below the heading on a phone, where
        there is no room beside it.

        ONLY WHILE THERE IS A HEADING TO PIN IT BESIDE. With none the
        wrapper has no height, so an absolutely placed link has nothing to
        sit in and lands on the cards. It goes back into the flow then, at
        the right-hand edge, which is where a link with no heading belongs.
      */}
      <div className={cn("mb-6", hasHeading && "relative")}>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          className="mb-0"
          align={align}
        />
        <div
          className={cn(
            "flex",
            /*
              OUT OF THE FLOW SO A CENTRED HEADING CAN CENTRE ON THE BAND,
              which is the whole reason this row is built the way it is — in
              the flow the heading centres on the space LEFT OVER and sits
              visibly off-centre.

              BUT NOT UNDER A HEADING RANGED RIGHT. Out of the flow reserves
              nothing, so a right-ranged heading ran straight underneath the
              link: measured at 1280, the text ended at 1248 and so did the
              band. A fixed 7rem of padding was tried and is worse — in the
              builder's 624px preview that reserve is a fifth of the row, and
              it pushed the heading from centre back to the LEFT of centre.
              Measured: -8px where the setting asked for +87.

              So for that one setting the link goes back in the flow, under
              the heading at the right-hand edge, which is where a link under
              a right-ranged heading belongs anyway.
            */
            hasHeading && align !== "right"
              ? "mt-4 justify-center sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:items-center"
              : "justify-end",
          )}
        >
          <ViewAllLink
            href={contentString(c, "ctaHref")}
            label={contentString(c, "ctaLabel")}
            on={props.section.background}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
        {items.map((item, index) => {
          const slug = (item.categorySlug ?? "").trim();
          const name = (item.label ?? "").trim() || nameOf.get(slug) || "";
          const tone = CARD_TONES[(item.tone ?? "").trim()] ?? CARD_TONES.neutral;
          const price = startingPriceOf(props.categoryStartingPrices?.[slug]);

          const card = (
            <>
              <div className={cn("relative aspect-square", tone)}>
                {/*
                  EDGE TO EDGE, and the tint is what sits BEHIND it.

                  This was inset on the tint, on the reasoning that a cut-out
                  product should float on a colour. The shop looked at it and
                  said the picture fills the card — and the layout it is drawn
                  from agrees: the pastel there is painted INTO the artwork,
                  swirls and all, not applied by CSS around it.

                  So the tint stops being a frame and becomes a backdrop: what
                  shows through a picture with no background of its own, and
                  what fills the card while one loads or if none was set.
                */}
                <OptimizedImage
                  src={item.image}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 25vw, 50vw"
                />
              </div>
              <div className="px-2 py-3 text-center">
                {name ? (
                  <p className="line-clamp-2 text-[13px] font-semibold text-foreground sm:text-sm">
                    {name}
                  </p>
                ) : null}
                {price !== null ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {priceLabel} {formatCurrency(price)}
                  </p>
                ) : null}
              </div>
            </>
          );

          const box =
            "flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs";

          return slug ? (
            <Link key={`${slug}-${index}`} href={routes.store.collection(slug)} className={box}>
              {card}
            </Link>
          ) : (
            <div key={`${item.image}-${index}`} className={box}>
              {card}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

/*
  ONE SHAPE, ONE PACE, AND NEITHER IS A SETTING.

  The shop asked for both boxes gone. They were a choice with no good
  answer behind it: the shape only works if the artwork is exported to
  match, so picking one in the builder without re-exporting gives a band of
  background either side of your own banner — and the seconds box invited a
  number (0.5, 60) that reads as a strobe or as a banner nobody sees turn.

  So the band states what it wants instead of asking, and the size is on the
  picture field, where the shop is standing when it matters.
*/
/*
  TWO SHAPES, AND ONLY WHEN THERE IS A SECOND PICTURE TO PUT IN ONE.

  1520/120 is 12.6:1, which on a 390px screen is a band 28px high — nothing
  written into a banner can be read in that. So a phone gets a 3.8:1 box and
  the row carries a picture cut for it, the way the hero already does.

  BUT THE TALL BOX ONLY HELPS IF THAT PICTURE EXISTS. Without one the wide
  banner is shown whole inside it, and `object-contain` does not enlarge
  anything: measured at 390, the box was 326x86 and the picture inside it
  326x26 — the same unreadable 26px with 60px of tint wrapped round it. On a
  tablet it was worse: a 927x244 box holding a picture 244px shorter than
  itself.

  That was a real mistake and it shipped, because the check measured the BOX
  and called it readable. So the shape is now a question about the content:
  a strip with a phone picture gets the tall box, and one without keeps the
  wide ratio at every width and is short on a phone — which is the honest
  state of a band that has one wide picture and nothing else.
*/
/*
  TWO SHAPES, AND THE SHOP PICKS — which is a reversal, and worth saying why.

  This was a setting, and it was removed as a choice with no good answer
  behind it. That was true while there was one band: picking a shape does
  nothing unless the artwork is exported to match, so the box may as well
  state what it wants.

  It stopped being true the moment there were two. The strip under the
  banner grid is a thin ribbon and right that way; the one under trending is
  a 4.6:1 banner, measured off the layout the shop held up — its picture
  spans about 1380 of a 1900px window and stands 297px tall. One ratio
  cannot be both, and neither is wrong.

  `strip` is the default, so the band already on the page keeps the shape it
  has.
*/
const STRIP_SHAPES = {
  strip: {
    wide: "aspect-[1520/120]",
    withPhone: "aspect-[760/200] lg:aspect-[1520/120]",
  },
  banner: {
    wide: "aspect-[1520/330]",
    withPhone: "aspect-[760/400] lg:aspect-[1520/330]",
  },
} as const;
/** How long each banner holds. */
const STRIP_SECONDS = 5;
/** The turn, in ms. One banner leaves, then the next arrives, each taking this. */
const STRIP_FLIP_MS = 360;

function BannerStripSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const align = sectionAlignOf(c, "left");
  /*
    Capped here as well as in the editor. The editor's limit stops an admin
    adding a fourth; it does nothing about a fourth that is already stored,
    and the page is what the customer sees.
  */
  const banners = renderableRows(parseListField(c, "banners"))
    .filter((banner) => Boolean(banner.image))
    .slice(0, BANNER_STRIP_MAX);

  /*
    Any of them, not all: the box is one shape for the whole strip, and a
    banner that has a phone picture is the one that needs the room.

    THE TALL PHONE BOX ONLY HELPS IF THAT PICTURE EXISTS. Without one the
    wide banner is shown whole inside it and `object-contain` enlarges
    nothing: measured at 390, a 326x86 box held a picture 326x26 — the same
    unreadable 26px with 60px of tint round it. That shipped, because the
    check measured the BOX and called it readable.
  */
  const chosen =
    STRIP_SHAPES[contentString(c, "shape") as keyof typeof STRIP_SHAPES] ??
    STRIP_SHAPES.strip;
  const shape = banners.some((banner) => banner.mobileImage?.trim())
    ? chosen.withPhone
    : chosen.wide;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    /*
      A visitor whose system asks for less movement gets none. Checked here
      rather than in CSS because stopping the fade would still leave the
      picture changing underneath it, which is the part that moves.
    */
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % count),
      STRIP_SECONDS * 1000,
    );
    return () => window.clearInterval(id);
  }, [count, paused]);

  /* A banner removed in the builder must not leave the strip on an index
     that no longer exists — the band would go blank with no clue why. */
  const current = count ? index % count : 0;

  if (count === 0) return null;

  /*
    The same header row as every product band: what this is on the left,
    the way in on the right. `SectionHeader` draws nothing when both are
    blank, which is the shipped state — so a strip with no heading is the
    bare band of artwork it has always been.
  */
  const hasHeader =
    Boolean(contentString(c, "overline").trim() || contentString(c, "title").trim()) ||
    Boolean(contentString(c, "ctaLabel").trim() && contentString(c, "ctaHref").trim());

  return (
    <SectionShell {...props}>
      {hasHeader ? (
        <SectionHeadingRow
          align={align}
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          className="mb-6 items-center"
          trailing={
            <ViewAllLink
              href={contentString(c, "ctaHref")}
              label={contentString(c, "ctaLabel")}
              on={props.section.background}
            />
          }
        />
      ) : null}
      {/*
        PAUSES WHEN SOMEBODY IS THERE.

        Not a hover effect — nothing changes on screen. It is the pause a
        thing that moves on its own has to have: a customer reading the
        small print, or tabbing onto a dot, should not have it turn under
        them. `focusWithin` covers the keyboard, where there is no pointer
        to hover with.
      */}
      <div
        className={cn(
          /*
            `perspective` is what makes the turn a FLIP rather than a
            squash: without it a rotated plane is scaled flat, with no
            near edge coming toward the reader.
          */
          "relative overflow-hidden rounded-2xl bg-cream-100 perspective-normal",
          shape,
        )}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
      >
        {banners.map((banner, i) => {
          /*
            THE PHONE GETS ITS OWN PICTURE, or the wide one shown WHOLE.

            Measured: the wide strip is 12.6:1, which on a 390px screen is a
            band 28 pixels tall — nothing written into a banner can be read
            in 28px, and no CSS fixes it, because the answer is a
            differently composed picture. The hero already carries one for
            exactly this reason.

            Without one the phone shows the wide banner letterboxed on the
            band's own tint rather than cropped to fill. A banner with its
            offer drawn into one end would lose the offer, and nothing here
            has seen the artwork. Letterboxed looks unfinished, which is the
            honest state for a picture that has not been exported yet.
          */
          const phone = banner.mobileImage?.trim();
          const alt = banner.label ?? "";
          const picture = (
            <>
              <OptimizedImage
                fill
                sizes="100vw"
                src={phone || banner.image || ""}
                alt={alt}
                className={cn(
                  "lg:hidden",
                  phone ? "object-cover" : "object-contain",
                )}
              />
              {/*
                The words are pixels inside the picture, so the alt is the
                only thing a screen reader has. Empty when the shop has not
                written one — an invented description of a picture nobody
                here has seen is worse than silence. It goes on BOTH, and
                only one of the two is ever displayed.
              */}
              <OptimizedImage
                src={banner.image ?? ""}
                alt={alt}
                fill
                sizes="100vw"
                className="hidden lg:block object-cover"
              />
            </>
          );
          /*
            Every banner is in the DOM, stacked, and only the current one is
            face on. A strip that swapped `src` would show the page's
            background between two pictures on every turn, because the next
            one starts loading when it becomes the current one.

            THE TURN IS A FLIP, in two halves rather than all at once.
            Every banner that is not current rests at the SAME angle, -90°,
            hinged on its top edge — so the outgoing one falls away from the
            reader and the incoming one drops in behind it, both travelling
            the same direction, the way a departure board moves.

            THE DELAY IS WHAT MAKES IT READ. Run both at once and the two
            banners cross through each other at 45°, which is a smear.
            Arriving is delayed by exactly as long as leaving takes, so one
            clears the frame before the next starts.

            `ease-in` on the way out and `ease-out` on the way in, so the
            pair is fastest in the middle and settles at both ends rather
            than stopping dead.

            The opacity goes with it because a plane at 90° is a hairline:
            without the fade there is a frame where neither banner has any
            width and the box shows its own fill.
          */
          return (
            <div
              key={`${banner.image}-${i}`}
              aria-hidden={i === current ? undefined : true}
              className={cn(
                "absolute inset-0 origin-top backface-hidden transition-[transform,opacity]",
                i === current
                  ? "[transform:rotateX(0deg)] opacity-100 ease-out"
                  : "pointer-events-none [transform:rotateX(-90deg)] opacity-0 ease-in",
              )}
              style={{
                transitionDuration: `${STRIP_FLIP_MS}ms`,
                transitionDelay: i === current ? `${STRIP_FLIP_MS}ms` : "0ms",
              }}
            >
              {banner.href ? (
                <Link
                  href={banner.href}
                  className="absolute inset-0"
                  tabIndex={i === current ? undefined : -1}
                >
                  {picture}
                </Link>
              ) : (
                picture
              )}
            </div>
          );
        })}

        {/*
          NO DOTS. The shop asked for them off, and at 28px tall on a phone
          they took a third of the band.

          What that costs is worth writing down: something that moves on its
          own has to be stoppable, and the dots were the obvious control.
          The pause is still there and still reachable both ways — a pointer
          over the band stops it, and so does tabbing onto the banner's own
          link, which is inside it. A strip with no link and no dots turns
          with nothing to stop it but the pointer.
        */}
      </div>
    </SectionShell>
  );
}

/**
 * HOW LONG IS LEFT TO ORDER FOR TODAY — or nothing at all.
 *
 * Three boxes of digits, the shop's own line, its own way in. The shape came
 * from a layout the shop held up; the deadline comes from the shop. A
 * countdown is the most persuasive thing that can go on a page and the
 * cheapest to fake, so every digit here is derived from
 * `commerce.sameDayCutoff` — the field `isPastSameDayCutoff` already refuses
 * an order against.
 *
 * SEVEN WAYS IT DRAWS NOTHING, each a state a real shop is in:
 *
 *   - `trust` is undefined: there are no server props at all, which is the
 *     builder preview between mount and its fetch landing;
 *   - `trust` is null: the settings read failed;
 *   - the shop named no cutoff, which is the shipped default and therefore
 *     every fresh install;
 *   - the stored string is not a time;
 *   - the shop's lead time is above 0 days, so there is no same-day window to
 *     close — decided on the server by `sameDayCutoffFor`, which sends "", so
 *     the browser never learns the lead time and cannot re-derive this wrong;
 *   - today's cutoff has gone. `timeLeftToday` answers null for that on its
 *     own and it is asked again every second, so the band removes ITSELF at
 *     the cutoff rather than standing there telling somebody to hurry for a
 *     delivery they can no longer have;
 *   - the shop has not written the line beside the clock.
 *
 * On the live page every one of those is the same `null`, returned BEFORE
 * `SectionShell` is constructed — so there is no padded empty stripe and no
 * gap, just one band fewer on a page whose rhythm is padding. In the builder
 * each says which one it is, because a shop that adds this band and sees an
 * empty screen cannot tell "waiting" from "broken" — the bargain
 * `RecentlyViewedSection` already strikes.
 */
function SameDayCountdownSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  /*
    FROM THE SERVER, AND FROM NOWHERE ELSE.

    Not `getCommerceSettings()`, which is the browser's settings cache and
    falls back to the SHIPPED defaults — and the shipped `sameDayCutoff` is
    "", so that would read as "no countdown" on a shop that has one and would
    ignore `deliveryLeadDays` entirely. `sameDayCutoffFor` on the server has
    already refused to hand over a cutoff for a shop that cannot deliver
    today.

    `?? ""` on a field the type says is always there, deliberately: `trust`
    crosses a JSON boundary to reach the builder preview, and
    `undefined.trim()` is a blank admin screen rather than a missing band.
  */
  const cutoff = (props.trust?.sameDayCutoff ?? "").trim();
  const headline = contentString(c, "headline").trim();

  /*
    CALLED BEFORE ANY EARLY RETURN, and called HERE rather than in
    `HomepageSectionRenderer`. In the switch, every one of the nine bands on
    the page mounts its own copy of that component, so the hook would tick and
    re-render all nine once a second. After a `return null` it would be a
    conditional hook, which is a different bug from the one being avoided.
  */
  const parts = countdownParts(useSameDayCountdown(cutoff));

  if (!parts || !headline) {
    if (!props.interactive) return null;
    /*
      THE BUILDER IS TOLD WHICH ONE IT IS, ordered by how hard each is to find
      from here: the settings screen is a different page, the headline box is
      six inches to the left.
    */
    return (
      <SectionShell {...props}>
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm leading-relaxed text-muted-foreground">
          {props.trust === undefined
            ? "Reading this shop’s settings…"
            : props.trust === null
              ? "This shop’s settings could not be read, so there is no deadline behind this band. It draws nothing on the live page rather than a made-up one."
              : !cutoff
                ? "Set Settings → Commerce → “Same-day orders close at”, and keep the delivery lead time at 0 days. Without both there is no same-day window, so this band draws nothing at all on the live page."
                : !headline
                  ? "Write the line that sits beside the clock, in the box on the left. Boxes of digits with nothing saying what is closing is not something to publish, so the band stays hidden until it is written."
                  : `Same-day orders closed at ${cutoff}, so this band is drawing nothing until midnight. Nothing is broken and nothing is hidden: a countdown that has run out would be telling somebody to hurry for a delivery they can no longer have.`}
        </p>
      </SectionShell>
    );
  }

  /*
    WHICH UNITS ARE SHOWN IS ITSELF PART OF THE FACT — and the rule that
    decides is in `delivery-date.ts`, beside the arithmetic it reads.

    Not here, and that is the point: a branch written inline can only be
    guarded by scanning this file for the shape of its own source, which is a
    test that passes for the very regression it names. `countdownCells` is
    pure, takes the three strings and returns the cells, so the rule can be
    asserted at 00:00:09 and mutated red without a browser.

    What it does: drops the leading zero units, keeps at most two. Above an
    hour that is hours and minutes; inside the last hour, minutes and seconds,
    which is the only stretch of the day where a second is the difference
    between an order landing today and not; inside the last minute, seconds
    alone. A previous cut of this branched on `parts.hours` only, which read
    "00 MINUTES | 40 SECONDS" for the final minute — the exact dead cell the
    two-unit clock exists to remove.

    NOT A COUNT THAT GROWS OR REDDENS as the time goes. It changes RESOLUTION
    rather than volume: the same colour, the same weight, different units. A
    band that gets louder as it empties is a pressure tactic wearing a fact's
    clothes, and this shop has had that scrubbed off its pages twice.

    NOTE WHAT THIS IS NOT: it does not make the digits and `parts.spoken`
    agree. `spoken` never says seconds at all — "12 minutes left" while the
    cells read MINUTES | SECONDS — and that is deliberate on its side, because
    a sentence that is only announced once has to stay true for longer than a
    tick. Two renderings of one fact at two resolutions, not a mismatch.
  */
  const cells = countdownCells(parts);

  return (
    <SectionShell
      {...props}
      /*
        A WASH OVER THE TONE, not instead of it.

        One flat fill is what the first cut of this looked like beside the
        reference: a rectangle of paint. The reference is lighter where the
        clock sits and deeper at the far end, and that GRADIENT is the part
        worth taking — its greens and blues are not.

        Every stop is either `transparent` or one of the shop's own tokens,
        and `background-image` sits over the tone's `background-color`
        rather than replacing it. So whichever of the six backgrounds the
        shop picks in the dropdown is still the colour underneath, and this
        only shapes the light on it. `--background` is the shop's palest
        surface and `--primary` its brand colour; at 8% the second is a
        suggestion of weight at the end of the strip, not a second fill.

        Angled from the top-left because that is where the eye starts and
        where the digits are. A ring rather than a border: `ring` draws
        inside the rounded corner, so it cannot leave the 1px notch a
        `border` leaves on a `rounded-2xl` box at some zoom levels.
      */
      panelClassName="bg-[radial-gradient(120%_150%_at_6%_-10%,var(--background)_0%,transparent_66%),linear-gradient(105deg,transparent_30%,color-mix(in_oklab,var(--primary)_13%,transparent)_100%)] ring-1 ring-border"
    >
      {/*
        NO `bg-*` HERE, and that is the point: SectionShell applies the
        Background setting BEFORE this className, so a colour passed here
        outranks it and the dropdown goes inert — three sections in this file
        did exactly that, and one showed "White" in the builder while
        rendering cream.

        `relative` is load-bearing rather than styling: Tailwind's `sr-only`
        is `position: absolute`, and with no positioned ancestor it lays out
        at its static position in the initial containing block and escapes
        every `overflow: hidden` on the way up.

        THREE ACROSS FROM `md`, NOT `sm`, and that is measured rather than
        taste. At a 640px viewport the container is `sm:px-6` and the panel
        another 24 a side, so the row has 544px; the clock takes ~177 and the
        button ~137, with two 32px gaps. That leaves the sentence — the only
        thing here that says WHAT is closing — about 166px at 24px type, which
        is seven characters a line. 640-767 is every small tablet and every
        1280 window at 200% zoom, and stacked is already the correct answer
        one pixel below it. At 768 the same sum gives ~293px, which holds a
        headline over two lines.
      */}
      <div className="relative flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:gap-8">
        {/*
          THE FACT, ONCE, AND NOT TICKING.

          A region that changes every second is either announced every second
          — 3,600 interruptions an hour, which makes the rest of the page
          unreachable — or never. So the digits are hidden and one sentence
          stands for them. It leads with the TIME, which never changes, and
          `spoken` drops the seconds so even that half stays true for a
          minute. No `aria-live` anywhere, and no `role="timer"`: both leave a
          live region in the markup for a later edit to switch on.

          The cutoff is read out as the shop typed it. A 12-hour rendering
          would be this software's second opinion about a time somebody
          already chose how to write.
        */}
        <p className="sr-only">
          Same-day orders close at {cutoff} today — {parts.spoken}.
        </p>
        <div
          className="flex shrink-0 flex-col items-center gap-2"
          aria-hidden="true"
        >
          {/*
            ONE INSTRUMENT, NOT TWO LOOSE NUMBERS.

            The tiles floated with 10px of band between them, so they read as
            separate figures rather than one reading — the reference has the
            same problem and answers it with nothing. A single shell split by a
            hairline says the parts belong together, and it is the STRUCTURE
            saying it rather than a colon, which is punctuation borrowed off a
            stopwatch.

            THE COLUMN COUNT FOLLOWS THE CELLS, because in the last minute
            there is one. `grid-cols-2` with a single child leaves half the
            shell empty and `divide-x` draws on `:not(:last-child)`, so the
            one cell would sit in a lopsided box with no divider in it. Both
            class names are written out rather than built from a template, so
            Tailwind's scanner can see them.

            `inline-grid` + `grid-cols-2` rather than two fixed squares: an
            auto-width inline grid takes the max-content of its widest cell and
            gives both columns that, so the two cells are identical without a
            magic number, and neither can clip its label at a larger base font or
            under browser zoom. That is worth more here than a fixed width: the
            longest label is what sizes a cell, and a shop's own heading font
            decides how long that is.

            MEASURED COST of not fixing it: the shell is 177.2px while the
            labels are HOURS|MINUTES and 186.8px while they are MINUTES|SECONDS,
            because "Seconds" is the wider word. So the clock block moves 6.6px
            once a day, at the one tick where the reading changes anyway — and
            0px on every other tick of the day, which is the number that
            matters and is measured below. `shrink-0` stops the flex row
            squeezing it.

            `bg-primary` + `text-primary-foreground`: appearance-tokens.ts sets
            `--primary` to the shop's own colour and `--primary-foreground` to
            `readableInkOn(primaryColor)`, so the ink is contrast-checked per
            shop rather than chosen once here. Not `bg-bakery-900` (every
            `--bakery-*` step is derived from the same primary, so a pale brand
            gives a pale box and the digits vanish), not `variant="bakery"`'s
            `text-white` (welded, and unreadable on a light primary), and not
            `--cream-50`, which is literally #ffffff and pinned there by decree.

            The divider and the unit labels are that same ink at 25% and 80%,
            for the same reason: a border colour picked here would be a hairline
            on one shop's primary and invisible on another's. Measured on four
            primaries — the shop's #6f4e37, a pale #f4e3c3 where
            `readableInkOn` flips to dark ink, a near-black #14110d and the Ink
            preset's #1f2a44 — the labels come out 5.48, 6.17, 12.11 and 9.62
            to 1, so the weakest of them still clears AA for body text; the
            divider lands 1.60-2.23, which is a separator rather than a seam.
            At 15% the pale case was 1.31 and effectively absent.
          */}
          <div
            className={cn(
              "inline-grid divide-x divide-primary-foreground/25 rounded-xl bg-primary text-primary-foreground",
              cells.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {cells.map(([label, value]) => (
              <span
                key={label}
                className="flex flex-col items-center gap-1 px-4 py-3"
              >
                {/*
                  `tabular-nums` and an equal-column grid are what keep this the
                  one thing on the homepage that does not move: a "1" is
                  narrower than a "0", and without them the cells breathe once a
                  second and the line beside them shuffles. A tick repaints two
                  glyphs and reflows nothing, which is why
                  `prefers-reduced-motion` has nothing here to suppress.

                  `lg:text-3xl` RATHER THAN `sm:`, so the digits step up with
                  the sentence instead of before it. They stepped at `sm` while
                  the headline was still `text-2xl`, which meant that in the
                  tightest three-across range the clock outweighed the only thing
                  on the band that says what is closing. Now they are 24px
                  together and 30px together.

                  AND NO BIGGER. Dropping to two cells left room to grow them and
                  they are not taking it: the sentence is the band, and digits
                  above it in the type scale would turn the shop's own line back
                  into a caption for a timer.
                */}
                <span className="font-heading text-2xl leading-none font-bold tabular-nums lg:text-3xl">
                  {value}
                </span>
                <span className="text-[0.625rem] leading-none font-semibold tracking-[0.12em] uppercase text-primary-foreground/80">
                  {label}
                </span>
              </span>
            ))}
          </div>
          {/*
            WHAT CLOSES, AND WHEN — the half of the fact the page never showed.

            "04 : 55" does not say what runs out or at what time, and the shop's
            headline beside it need not mention either. The sr-only sentence
            above says both. So the SIGHTED reader was the one getting less,
            from a band whose entire case is that the deadline is real and
            checkable.

            NO NEW WORDS, and that is deliberate under a rule that says wording
            is the shop's: "Same-day orders close at" is the label on the
            Settings -> Commerce field this figure is read from, verbatim, and
            the opening of the sr-only sentence. The figure is `cutoff` itself,
            printed as the shop typed it — a 12-hour rendering would be this
            software's second opinion about a time somebody already chose how to
            write.

            Inside the `aria-hidden` block on purpose: the spoken version stays
            ONE sentence instead of being read out, then read out again.

            `text-muted-foreground` is fixed in globals.css rather than written
            by appearance-tokens, and so is every `--band-*` tone, so this
            pairing holds whatever palette a shop picks and in dark mode — where
            `--muted-foreground` is #e4d5c2 on a #383021 sand.
          */}
          <p className="text-[0.6875rem] leading-none font-semibold tracking-[0.04em] text-muted-foreground">
            Same-day orders close at {cutoff}
          </p>
        </div>
        {/*
          THE SENTENCE IS THE BAND, which is what the reference gets right and
          the first cut of this did not: at `text-lg` beside three boxes it
          read as a caption for them. It is the only thing here that says what
          is closing.
        */}
        <p className="min-w-0 font-heading text-xl leading-snug font-bold text-balance sm:text-2xl md:flex-1 lg:text-3xl">
          {headline}
        </p>
{/*
          A BUTTON, NOT THE ROW PILL — and this band is the reason the two
          differ. `ViewAllLink` is quiet on purpose: at the end of a heading
          it labels the row beneath it rather than competing with the cards.
          There are no cards beneath this one. It is a sentence with a
          deadline on it, and the control at the end is the only thing to
          press. On a sand band the pill also comes out
          `bg-band-sand-strong` — sand on sand, which is the low-contrast
          result the reference gets its punch by avoiding.

          `bg-primary` joins the tiles rather than introducing a third
          colour, and `--primary-foreground` is `readableInkOn(primaryColor)`,
          so the ink is contrast-checked per shop instead of chosen here. Not
          `<Button>`: its default variant carries `hover:bg-primary/90`, and
          no hover is a standing rule on this shop.

          NOTHING WITHOUT BOTH HALVES, the same rule `ViewAllLink` keeps: a
          label with no destination is a button that does not work, and a
          destination with no label is a blank box.
        */}
        {contentString(c, "ctaHref") && contentString(c, "ctaLabel") ? (
          <Link
            href={contentString(c, "ctaHref")}
            /*
              `min-h-11` rather than padding alone: measured at 390px the row
              pill came out 31px tall, under every target-size guideline
              there is, and the label here is 13px type so padding could not
              reach it either.
            */
            /*
              AND A FOCUS RING THE KEYBOARD CAN SEE. It is the only focusable
              thing in the band and it had nothing of its own: Tailwind's base
              layer sets `outline-ring/50` on `*` and never sets a width, so a
              keyboard user got whatever the UA chose to draw over a solid
              `bg-primary`.

              `outline-foreground` rather than the `outline-ring`/`ring-ring`
              habit everywhere else in this repo: `--ring` is
              `appearanceCssVariables`' ACCENT, a shop-chosen colour that on
              this shop is #d4a373 — about 1.9:1 on the sand band, i.e. no ring
              at all on exactly the pale palettes that need one. `--foreground`
              is fixed in globals.css (#2d2d2d light, #faf8f4 dark) and so are
              the four `--band-*` tones, so this is a visible 2px on all six
              backgrounds, in both themes, on any palette. `outline` rather than
              `ring`, because `ring` is a box-shadow and would need a matching
              `ring-offset-color` not to sit flush against the button.
            */
            className="flex min-h-11 max-w-full shrink-0 items-center justify-center rounded-lg bg-primary px-6 text-center text-sm font-bold tracking-wider text-primary-foreground uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            {contentString(c, "ctaLabel")}
          </Link>
        ) : null}
      </div>

      {/*
        SAYS SO WHILE IT IS WORKING, not only once it has gone. An admin who
        opens the builder in the morning would otherwise never learn that this
        band leaves the page at lunchtime. Reads the real cutoff, so it cannot
        drift from the setting, and only the builder ever renders it.
      */}
      {props.interactive ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Only you can see this line. Same-day orders close at {cutoff}, so this
          band draws nothing on the live page from then until midnight. The clock
          shows hours and minutes until the last hour, minutes and seconds inside
          it, and seconds alone in the last minute — so the first cell is never a
          “00”.
        </p>
      ) : null}
    </SectionShell>
  );
}

function TileGridSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "center");
  const tiles = renderableRows(parseListField(c, "tiles"));
  /*
    THE CARD IS THE SHAPE THE SHOP HELD UP: the picture in a bordered box
    at 4:3, and the label in a tinted bar along the foot of it rather than
    loose on the page below. Plain is what this band has always drawn and
    is what every grid already published is still using.
  */
  const card = contentString(c, "shape").trim() === "card";

  if (tiles.length === 0) return null;

  /**
   * Two to six per row, clamped.
   *
   * A number typed into a box reaches this, and one column is a list while
   * twelve is unreadable — so the shop's choice is honoured within bounds
   * rather than obeyed off a cliff. The classes are WRITTEN OUT because
   * Tailwind cannot see a class name built at runtime.
   */
  const columns = Math.min(6, Math.max(2, contentNumber(c, "columns", 4)));
  const columnClass =
    {
      2: "grid-cols-2",
      3: "grid-cols-2 sm:grid-cols-3",
      4: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
      5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
      6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
    }[columns] ?? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align={align}
      />
      <div className={cn(hasHeading && "mt-6", "grid gap-4 sm:gap-5", columnClass)}>
        {tiles.map((tile, index) => {
          const body = (
            <>
              <div
                className={cn(
                  "relative overflow-hidden bg-muted",
                  card
                    ? /*
                        4:3, AND THE CORNERS ONLY AT THE TOP. The picture is
                        the top half of one card, so rounding its foot would
                        cut a notch out of the bar underneath it.
                      */
                      "aspect-[4/3] rounded-t-xl"
                    : "aspect-square rounded-xl",
                )}
              >
                <OptimizedImage
                  src={tile.image ?? ""}
                  alt={tile.label ?? ""}
                  fill
                  className="object-cover"
                  /*
                    The shop chooses 4, 5 or 6 across at lg. 25vw is the
                    WIDEST of those, so a six-across row asks for a little
                    more than it paints — the other way round is a soft tile.
                  */
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                />
              </div>
              {tile.label ? (
                <p
                  className={cn(
                    card
                      ? "flex min-h-12 items-center justify-center bg-cream-100 px-3 py-2.5 text-center text-sm font-semibold"
                      : "mt-2 text-center text-sm font-medium",
                  )}
                >
                  {tile.label}
                </p>
              ) : null}
            </>
          );

          /*
            THE CARD IS THE TILE ITSELF, so the border and the clip belong
            to whichever element wraps it — a link when the shop gave the
            tile one, a plain box when it did not.
          */
          const shell = cn(
            "group/tile",
            card && "block overflow-hidden rounded-xl border border-border bg-card",
          );

          return tile.href ? (
            <Link key={`${tile.label}-${index}`} href={tile.href} className={shell}>
              {body}
            </Link>
          ) : (
            <div key={`${tile.label}-${index}`} className={shell}>
              {body}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function WhyUsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "center");
  /**
   * The cards, from the section's own content.
   *
   * They were a hardcoded array in this function: "Over six decades of baking
   * expertise", "Finest chocolate", "Order by 2 PM for same-day delivery across
   * major cities", each asserted for whichever shop runs this CMS. The heading
   * above them was editable while the claims underneath were not.
   *
   * Empty renders no section — a heading over nothing is worse than nothing.
   */
  const items = renderableRows(parseListField(c, "items"));
  /*
    `renderableRows`, NOT `photoRows`. A tile with no picture is a tile with
    an icon, which is what this band drew before it could take pictures at
    all — dropping picture-less rows would silently delete them.
  */
  const strip = contentString(c, "layout").trim() === "strip";

  if (items.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align={align}
      />
      <div
        className={cn(
          /*
            THE TOP MARGIN BELONGS TO THE HEADING, not to the panel. It is
            here to sit against the heading's own `mb-6`; with a blank
            heading — which this band on this shop's page has — there is
            nothing to sit against and it becomes 24px of air above the
            panel that is not there below it. Measured at 1440: 48px above,
            24px below, which is what the shop drew a box around.
          */
          hasHeading && "mt-6",
          strip
            ? /*
                ONE PANEL, NOT FOUR CARDS. The shape the shop held up puts the
                four points inside a single tinted band with no border round
                each one — the points read as one promise in four parts rather
                than as four things to compare.

                MEASURED AGAINST THAT LAYOUT rather than guessed. Its panel
                is 1540 wide and 162 tall with a 24px corner, 90px of air
                inside each end and a 78px picture — which, scaled to this
                page's 1216px column, is a 24px corner, about 71px of air
                and a 62px picture. The air is taken at 48 rather than 71
                because this column is narrower than the one being copied:
                at 71 the four points get 269px each against that layout's
                340, and they start wrapping where it does not.

                `band-sand` and not `cream-100`: the tint being copied is a
                warm butter the eye reads as a panel, and cream-100 is
                rgb(250,248,244) — near enough to white that the band did
                not read as one at all.
              */
              "grid gap-6 rounded-[1.25rem] bg-band-sand px-6 py-6 sm:gap-8 sm:px-12 sm:py-8 md:grid-cols-2 xl:grid-cols-4"
            : "grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4",
        )}
      >
        {items.map((item, index) => {
          const picture = (item.image ?? "").trim();
          /*
            THE SHOP'S OWN PICTURE, AND NOTHING ELSE.

            This band used to offer a choice of four lucide icons and the
            shop asked for them gone: the layout it is drawn from uses small
            illustrations, and four line icons are not a smaller version of
            that — they are a different thing that happens to fit the box.

            A point with no picture draws NO circle rather than an empty
            one. An empty disc beside two lines reads as a picture that
            failed to load, which is a worse thing to publish than two lines
            on their own.

            `object-cover` inside a round mask, so a square export fills it
            and anything else is cropped rather than squashed. And no tint
            behind it: the artwork this is for carries its own background,
            and a cream disc under a transparent PNG puts a colour the shop
            never chose behind the shop's own illustration.
          */
          const badge = picture ? (
            <span
              className={cn(
                "relative block shrink-0 overflow-hidden rounded-full",
                strip ? "size-[4.25rem]" : "mb-4 size-14",
              )}
            >
              <OptimizedImage
                src={picture}
                alt=""
                fill
                className="object-cover"
                /*
                  68px painted at 390, 768 and 1440 alike — it is a fixed tile,
                  not a fraction of the page. It was fetching the full file.
                */
                sizes="72px"
              />
            </span>
          ) : null;

          return (
            <div
              key={`${item.title}-${index}`}
              className={cn(
                strip
                  ? "flex items-center gap-3 sm:gap-4"
                  : "rounded-xl border border-border bg-card p-5",
              )}
            >
              {badge}
              <div className={strip ? "min-w-0" : undefined}>
                {item.title ? (
                  <p className="font-heading font-semibold">{item.title}</p>
                ) : null}
                {item.description ? (
                  <p
                    className={cn(
                      /*
                        DARK AND TIGHT IN THE STRIP, quiet and airy in the
                        cards. In the layout being copied the second line is
                        the same near-black as the first and sits about 6px
                        under it — the two read as one sentence broken in
                        half, which is why every point there is two lines.
                        Muted grey at `leading-relaxed` read as a caption
                        under a heading instead.
                      */
                      strip
                        ? "text-sm leading-snug text-foreground/75"
                        : "mt-1.5 text-sm leading-relaxed text-muted-foreground",
                    )}
                  >
                    {item.description}
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function TestimonialsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "center");
  const items = props.testimonials
    ? selectStorefrontTestimonials(props.testimonials)
    : getStorefrontTestimonials();

  /**
   * Empty renders no section — the same rule every other section here follows,
   * and this was the one that did not.
   *
   * Testimonials are the section a shop is most likely to empty deliberately:
   * the ones it ships with are not its own, so drafting all of them is the
   * correct first move. Doing that painted a full-height band with a heading
   * and an empty grid under it — the shop looked like it had no customers
   * rather than like it had not written this section yet.
   */
  if (items.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align={align}
      />
      <div className={cn(hasHeading && "mt-6", "grid gap-4 sm:gap-5 md:grid-cols-3")}>
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col rounded-xl border border-border bg-card p-6"
          >
            <RatingStars rating={item.rating} className="mb-4 text-gold-300" />
            <Quote className="mb-2 size-6 text-gold-300/60" />
            <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
              {item.content}
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-border pt-4">
              <div className="relative size-10 shrink-0 overflow-hidden rounded-full">
                <OptimizedImage src={item.avatar} alt={item.name} fill className="object-cover" sizes="40px" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.role}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

function FaqSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "center");
  const maxItems = contentNumber(c, "maxItems", 6);
  const items = props.faqs
    ? selectStorefrontFaqs(props.faqs)
    : getStorefrontFaqs();

  return (
    <SectionShell {...props} noReveal>
      <div className="mx-auto max-w-3xl">
        <ScrollReveal>
          <SectionHeader
            overline={contentString(c, "overline")}
            title={contentString(c, "title")}
            align={align}
          />
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <Accordion className={cn(hasHeading && "mt-8", "space-y-3")}>
            {items.slice(0, maxItems).map((faq) => (
              <AccordionItem
                key={faq.id}
                value={faq.id}
                className="overflow-hidden rounded-2xl border border-border bg-card transition-colors"
              >
                <AccordionTrigger className="px-5 py-4 text-left font-heading font-semibold hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4 leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollReveal>
      </div>
    </SectionShell>
  );
}

/**
 * WHAT THIS BROWSER HAS LOOKED AT.
 *
 * The only band on this page that is different for every visitor. It reads
 * `localStorage`, which does not exist on the server — so it starts empty,
 * on both sides of hydration, and fills in an effect. Reading during render
 * would put a row in the browser that is not in the HTML, which React
 * reports as a hydration mismatch and then throws the client tree away.
 *
 * SLUGS ARE RESOLVED AGAINST THE SHOP'S OWN RECORDS, never against anything
 * the browser holds: `getRecentlyViewedProducts` takes the catalogue as a
 * required argument because the version that did not once rendered a DEMO
 * cake's price into a customer's cart, which checkout then refused.
 *
 * A NEW VISITOR HAS LOOKED AT NOTHING, so the band draws nothing at all —
 * a heading over an empty strip is worse than no band. The builder says so
 * instead of vanishing, because a section that renders nothing cannot be
 * selected and an admin cannot fix what they cannot click.
 */
function RecentlyViewedSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const labels = useBusinessLabels();
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "left");
  /*
    CLAMPED TO THE CEILING. The browser only ever keeps
    RECENTLY_VIEWED_MAX slugs — truncated on the way in as well as on the
    way out — so a shop typing twelve into the box would be promised twelve
    and shown eight, with nothing on the screen to explain the difference.
  */
  const maxCount = Math.min(
    RECENTLY_VIEWED_MAX,
    contentNumber(c, "maxCount", RECENTLY_VIEWED_MAX),
  );
  const catalogue = props.catalog;
  const [seen, setSeen] = useState<LandingProduct[]>([]);

  useEffect(() => {
    const read = () => setSeen(getRecentlyViewedProducts(catalogue ?? []));
    read();
    window.addEventListener(RECENTLY_VIEWED_UPDATED_EVENT, read);
    return () => window.removeEventListener(RECENTLY_VIEWED_UPDATED_EVENT, read);
  }, [catalogue]);

  const cakes = seen.slice(0, maxCount);
  const ctaLabel = contentString(c, "ctaLabel");
  const ctaHref = contentString(c, "ctaHref");

  if (cakes.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          align={align}
        />
        <p
          className={cn(
            hasHeading && "mt-6",
            "rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground",
          )}
        >
          This band shows each visitor what THEY have looked at, so it is
          empty until somebody opens a {labels.productWord.toLowerCase()} page. It
          draws nothing at all on the live page while it is empty.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <ScrollReveal>
        <SectionHeadingRow
          align={align}
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          className="items-center"
          trailing={
            ctaHref && ctaLabel ? (
              <ViewAllLink href={ctaHref} label={ctaLabel} on={props.section.background} />
            ) : null
          }
        />
      </ScrollReveal>
      {/*
        THE SAME 24px EVERY OTHER PRODUCT ROW PUTS UNDER ITS HEADING.

        Measured across the page: trending, photo-cakes and featured all sit
        at 24; this band had 0, so its cards started against the words. The
        gap belongs to the heading, so it goes when there is none.
      */}
      <div className={cn(hasHeading && "mt-6")}>
        <ScrollStrip>
          {cakes.map((cake) => (
          <ProductCard
            key={cake.id}
            cake={cake}
            className="h-auto w-[calc((100%-1rem)/1.6)] shrink-0 snap-start sm:w-[calc((100%-1.25rem)/2)] lg:w-[calc((100%-3.75rem)/4)]"
            showWishlist={false}
          />
        ))}
        </ScrollStrip>
      </div>
    </SectionShell>
  );
}

function OffersSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const hasHeading = sectionHeaderDraws(
    contentString(c, "overline"),
    contentString(c, "title"),
  );
  const align = sectionAlignOf(c, "center");
  const maxCount = contentNumber(c, "maxCount", 3);
  // The shop's live coupons, read on the server. This row used to map the
  // hardcoded `specialOffers`, so it advertised BDAY20 whether or not the coupon
  // existed, was still active, or still gave 20% — and checkout refused the code
  // it had just shown the customer.
  const offers = (props.offers ?? getHomepageOffers(maxCount)).slice(0, maxCount);

  // A shop with no live coupon has no special offers. Saying so in the builder
  // is useful; saying it to a customer under a "Special Offers" heading is not,
  // so on the storefront the section simply does not appear.
  if (offers.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          align={align}
        />
        <p className={cn(hasHeading && "mt-8", "rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground")}>
          No active coupons, so this section is hidden on the live homepage. Add
          one under Commerce → Coupons and it appears here.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align={align}
      />
      <div className={cn(hasHeading && "mt-6", "grid gap-4 sm:gap-5 md:grid-cols-3")}>
        {offers.map((offer) => (
          <article
            key={offer.id}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="relative aspect-[3/2] bg-muted">
              <OptimizedImage src={offer.image} alt={offer.title || offer.discount} fill className="object-cover" sizes="33vw" />
              <Badge variant="gold" className="absolute top-3 left-3">
                {offer.discount}
              </Badge>
            </div>
            <div className="space-y-3 p-5">
              {/* Empty when the coupon's label just repeats the discount the badge
                  already shows — see sameCopy in coupon-offers.ts. */}
              {offer.title ? (
                <h3 className="font-heading text-lg font-semibold">{offer.title}</h3>
              ) : null}
              <p className="text-sm text-muted-foreground">{offer.description}</p>
              {offer.code ? (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-gold-300 bg-gold-50 px-3 py-2">
                  <Tag className="size-3.5 text-gold-700" />
                  <span className="font-mono text-sm font-semibold text-gold-800">{offer.code}</span>
                  {/* The condition checkout holds them to. Without it the card
                      sends a small basket to a checkout that refuses the code. */}
                  {offer.minSpend ? (
                    <span className="text-xs text-gold-800/80">{offer.minSpend}</span>
                  ) : null}
                </div>
              ) : null}
              <Button variant="bakery" className="w-full" render={<Link href={routes.store.collections} />}>
                Shop now
              </Button>
            </div>
          </article>
        ))}
      </div>
    </SectionShell>
  );
}

export function HomepageSectionRenderer(props: HomepageSectionRendererProps) {
  const railFor = (source: HomepageProductSource, maxCount: number) =>
    props.rails?.[source]?.slice(0, maxCount) ?? getHomepageProducts(source, maxCount);
  /**
   * The open sibling of `railFor`.
   *
   * No `getHomepageProducts` fallback: that function takes one of the six
   * fixed sources, and a category slug is not one of them. A row whose
   * category has been deleted, or whose slug was never filled in, renders
   * empty — which is what it is.
   */
  const categoryRailFor = (slug: string, maxCount: number) =>
    props.categoryRails?.[slug]?.slice(0, maxCount) ?? [];

  const { section } = props;

  switch (section.type) {
    case "hero":
      return <HeroSection {...props} />;
    case "our-menu":
      return <OurMenuSection {...props} />;
    case "featured-cakes":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("featured", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "trending":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("trending", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "best-sellers":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("best-sellers", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    /**
     * A ROW OF ANY CATEGORY THE SHOP HAS.
     *
     * The three category rows below this — photo-cakes, eggless, seasonal —
     * are bakery slugs frozen into the section type. They stay, because
     * layouts already published carry them, but a shop adds THIS one and
     * picks the category from its own list.
     */
    case "category-rail":
      return (
        <ProductGridSection
          {...props}
          cakes={categoryRailFor(
            contentString(section.content, "categorySlug"),
            contentNumber(section.content, "maxCount", 4),
          )}
          showCta
        />
      );
    case "tabbed-rail":
      return <TabbedRailSection {...props} />;
    case "banner-grid":
      return <BannerGridSection {...props} />;
    case "banner-strip":
      return <BannerStripSection {...props} />;
    case "same-day-countdown":
      return <SameDayCountdownSection {...props} />;
    case "category-price-cards":
      return <CategoryPriceCardsSection {...props} />;
    case "tile-grid":
      return <TileGridSection {...props} />;
    case "blog-cards":
      return <BlogCardsSection {...props} />;
    case "recently-viewed":
      return <RecentlyViewedSection {...props} />;
    case "offers":
      return <OffersSection {...props} />;

    case "photo-cakes":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("photo-cakes", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );

    case "eggless":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("eggless", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "seasonal":
      return (
        <ProductGridSection
          {...props}
          cakes={railFor("seasonal", contentNumber(section.content, "maxCount", 4))}
          showCta
        />
      );
    case "why-us":
      return <WhyUsSection {...props} />;
    case "testimonials":
      return <TestimonialsSection {...props} />;
    case "faq":
      return <FaqSection {...props} />;
    default:
      return null;
  }
}
