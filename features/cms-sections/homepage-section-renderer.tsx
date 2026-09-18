"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import {
  ArrowRight,
  Award,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
  Camera,
  Clock,
  Heart,
  Leaf,
  Mail,
  MapPin,
  Phone,
  Quote,
  Send,
  Store,
  Tag,
  Truck,
  Palette,
} from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { SectionHeader } from "@/components/shared/section-header";
import { RatingStars } from "@/components/shared/rating-stars";
import { ScrollReveal, StaggerReveal } from "@/components/shared/scroll-reveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  LandingCategory,
  LandingOffer,
  LandingProduct,
} from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { selectActiveHeroBanners } from "@/features/content/lib/banners-utils";
import type { Banner } from "@/types/media";
import {
  limitRows,
  parseHeroSlides,
  parseListField,
  photoRows,
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
import { heroCopySideOf, heroSlidesFor } from "./lib/section-utils";
import type { HomepageSectionInstance, SectionBackground } from "@/types/homepage-builder";
import type { FaqItem, Testimonial } from "@/types/content";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import { isSafeSocialUrl } from "@/features/settings/lib/settings-utils";
import { toast } from "sonner";
import { addNewsletterSubscriber } from "@/features/inquiries/lib/newsletter-repository";
import { formatCurrency } from "@/utils/format";
import { useBusinessLabels } from "@/hooks/use-business-labels";

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

function contentBoolean(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback = false
): boolean {
  const value = content[key];
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
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
            <div className={cn("rounded-2xl px-4 py-6 sm:px-6 sm:py-8", panelTone)}>
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

function OurMenuSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 8);
  const items = (props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount);

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
 * Where to find the shop.
 *
 * This section used to be entirely fictional. A pincode box waited 600ms and
 * toasted "Stores found — showing outlets near <whatever they typed>" having
 * searched nothing, beside three hardcoded Mumbai outlets at fixed distances of
 * 1.2 / 3.5 / 6.8 km. A customer in Delhi was told three shops in Mumbai were
 * around the corner. The NewsletterSection further down this same file was fixed
 * for exactly this — a form that said "Subscribed!" and wrote nothing — and the
 * fix stopped at that form.
 *
 * There is no outlet list in this CMS to search: Settings → Contact holds one
 * address, one phone and one set of opening hours. So this shows those, and the
 * search that never happened is gone.
 */
function StoreLocatorSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const location = props.storeLocation ?? null;

  // The heading, description and button label are the admin's own words, shown
  // as typed. An earlier attempt here swapped the shipped copy at render time,
  // which meant an admin who deliberately typed "Find a Store Near You" saw
  // something else on the storefront — and saw it differ from their own editor
  // field two inches away in the builder preview. The seeded wording is fixed
  // where it belongs, in the registry defaults, so new sections and resets get
  // honest copy and existing content stays the admin's.
  const title = contentString(c, "title");
  const buttonLabel = contentString(c, "buttonLabel", "Get Directions");

  // Nothing to show means nothing to show. Rendering the heading alone left a
  // shop advertising "Find a Store Near You" above an empty panel — the seeded
  // copy is still in most stored layouts, so on a shop that has not filled in
  // its address that heading is the last thing that should survive. The builder
  // says why instead, so the admin is not left guessing.
  if (!location) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8">
          This section shows your shop&apos;s address and opening hours from
          Settings → Contact. Until you set a real address there it stays hidden
          on the live homepage — the shipped example address is in Mumbai.
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <div className="grid gap-8 rounded-2xl border border-border bg-card p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="space-y-5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
            <MapPin className="size-5" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
              {contentString(c, "overline")}
            </p>
            <h2 className="font-heading text-xl font-bold sm:text-2xl">{title}</h2>
          </div>
          <Button
            variant="bakery"
            className="h-11"
            render={<a href={location.mapUrl} target="_blank" rel="noopener noreferrer" />}
          >
            <MapPin className="size-4" />
            {buttonLabel}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3 rounded-xl border border-border bg-cream-100 p-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-card text-bakery-700">
              <Store className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">{location.address}</p>
              {location.phone ? (
                <a
                  href={`tel:${location.phone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Phone className="size-3" />
                  {location.phone}
                </a>
              ) : null}
            </div>
          </div>

          {/* Only the shop's own hours. The three shipped rows are dropped as a
              set upstream — printing seeded opening times is a claim about when
              a stranger can turn up at the door. */}
          {location.hours.length > 0 ? (
            <div className="rounded-xl border border-border bg-cream-100 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Clock className="size-3.5 text-bakery-700" />
                Opening hours
              </p>
              <dl className="space-y-1">
                {location.hours.map((entry) => (
                  <div key={entry.day} className="flex justify-between gap-3 text-xs">
                    <dt className="text-muted-foreground">{entry.day}</dt>
                    <dd className="font-medium text-foreground">{entry.hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
        </div>
      </div>
    </SectionShell>
  );
}

function CategoriesSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  const items = (props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount);

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
        />
      </ScrollReveal>
      {/*
        SIX ACROSS, not three.

        At three columns in a 1440px column each tile was 464px wide, so a
        4:3 picture of a category was 348px tall — larger than the product
        photographs further down the page, for a link whose whole content is
        a name and a count. Six categories then took two rows and 1,018px.

        The storefront this is drawn from draws the same thing at about
        200px: a row of small pictures you scan, not six posters.
      */}
      <StaggerReveal className="mt-6 grid gap-4 sm:gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            // Same resting lift as the product cards below; a row of tiles
            // and a row of cards on one page should not be drawn two ways.
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
          >
            <div className="relative aspect-[4/3] bg-muted">
              {category.image ? (
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover"
                  /*
                    The tile is a sixth of the column now, not a third — a
                    300px hint asked every browser for roughly twice the
                    picture it draws, six times over, above the fold.
                  */
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 240px"
                />
              ) : null}
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground">{category.count} cakes</p>
            </div>
          </Link>
        ))}
      </StaggerReveal>
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
        />
        {/*
          The advice has to match how the row actually chooses.

          It said "Flag some cakes under Products" for every row, and for two of
          them there is no longer a flag to set: Eggless and Seasonal select on
          the CATEGORY now, which is what the nav links and the collection pages
          read. An admin following this could look for a tick that does not
          exist and conclude the builder was broken.
        */}
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground sm:p-8">
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
        <div className="flex items-center justify-between gap-4">
          <SectionHeader
            overline={contentString(c, "overline")}
            title={contentString(c, "title")}
            align="left"
            className="mb-0 min-w-0"
          />
          {props.showCta ? <ViewAllLink href={ctaHref} label={ctaLabel} on={props.section.background} /> : null}
        </div>
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
              showAddToCart={false}
              showWishlist={false}
            />
          ))}
        </ScrollStrip>
      </div>
    </SectionShell>
  );
}

const whyIcons = { Award, Leaf, Truck, Palette } as const;

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
        <div className="flex items-end justify-between gap-x-4 border-b border-border sm:gap-x-6">
          <div className="flex min-w-0 flex-col items-start gap-y-2 sm:flex-row sm:items-end sm:gap-x-5 sm:gap-y-0">
            <SectionHeader
              overline={contentString(c, "overline")}
              title={contentString(c, "title")}
              align="left"
              className="mb-0 shrink-0 pb-0 sm:pb-2.5"
            />
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
            <div className="no-scrollbar -mb-2 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-2 sm:w-auto">
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
          </div>
          <div className="shrink-0 pb-2.5">
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
                showAddToCart={false}
                showWishlist={false}
              />
            ))}
          </ScrollStrip>
        </div>
      )}
    </SectionShell>
  );
}

function PromoCollageSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const cards = renderableRows(parseListField(c, "cards"));

  if (cards.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
      />
      {/*
        `auto-rows-fr` so a wide card and the small ones beside it line up,
        and a wide card spans two columns rather than being a different
        component — the reference's three-wide-then-five-small band is one
        grid, not two.
      */}
      <div className="mt-6 grid gap-4 sm:gap-5 auto-rows-fr sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => {
          const body = (
            <>
              {card.image ? (
                /*
                  `flex-1` WITH A FLOOR, not a fixed ratio.

                  `auto-rows-fr` above makes every card in a row as tall as
                  the tallest — and a wide card's 16:9 picture at double
                  width is much taller than its neighbours'. At a fixed
                  ratio the small cards kept their own short picture and
                  grew a band of white underneath it instead, which is what
                  the browser showed. Letting the picture grow into the
                  space fills the card rather than padding it.
                */
                <div className="relative min-h-44 flex-1 overflow-hidden bg-muted">
                  {/*
                    SafeImage, not next/image: these URLs are admin-typed on
                    any host, and an un-listed host throws the render of the
                    whole homepage.
                  */}
                  <SafeImage src={card.image} alt={card.title ?? ""} />
                </div>
              ) : null}
              <div className="p-4">
                {card.title ? (
                  <p className="font-heading font-semibold">{card.title}</p>
                ) : null}
                {card.subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{card.subtitle}</p>
                ) : null}
                {card.ctaLabel ? (
                  <span className="mt-3 inline-flex text-sm font-medium text-bakery-700">
                    {card.ctaLabel}
                  </span>
                ) : null}
              </div>
            </>
          );

          const className = cn(
            "flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm",
            // A card with no link is still a card: a banner can be artwork
            // rather than a destination.
            /*
              `rowFlag`, not the value itself. A row's values are all strings
              by the time they reach here, so an UNTICKED box arrived as the
              string "false" and spanned two columns.
            */
            rowFlag(card.wide) ? "sm:col-span-2" : "",
          );

          return card.href ? (
            <Link key={`${card.title}-${index}`} href={card.href} className={className}>
              {body}
            </Link>
          ) : (
            <div key={`${card.title}-${index}`} className={className}>
              {body}
            </div>
          );
        })}
      </div>
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
/**
 * THE SHOP'S OWN WRITING, folded away until somebody wants it.
 *
 * A storefront of this kind carries a long block of prose at the foot of the
 * homepage. Left open it is most of the page's height for the part of it
 * that is read least, so the first paragraph stands and the rest is behind a
 * control — which is what the layout this is drawn from does too.
 *
 * The toggle is NOT rendered when there is only one paragraph: a control
 * that reveals nothing is worse than no control.
 */
function SeoProseSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const blocks = renderableRows(parseListField(c, "blocks"));
  const [open, setOpen] = useState(false);

  if (blocks.length === 0) return null;

  const shown = open ? blocks : blocks.slice(0, 1);

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align="left"
        className="mb-4"
      />
      <div className="space-y-4">
        {shown.map((block, index) => (
          <div key={`${block.heading}-${index}`} className="space-y-1.5">
            {block.heading ? (
              <h3 className="text-sm font-semibold text-foreground">{block.heading}</h3>
            ) : null}
            {block.body ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {block.body}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      {blocks.length > 1 ? (
        <button
          type="button"
          onClick={(event) => {
            /*
              The shell makes the whole band a select target in the builder,
              so without this an admin pressing Read more selects the section
              and never sees the text open.
            */
            event.stopPropagation();
            setOpen((value) => !value);
          }}
          className="mt-4 text-sm font-semibold text-bakery-700 underline-offset-4"
          aria-expanded={open}
        >
          {open ? "Show less" : "Read more"}
        </button>
      ) : null}
    </SectionShell>
  );
}

/** A row of the shop's own articles. Empty is not a band. */
function BlogCardsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const posts = renderableRows(parseListField(c, "posts"));
  const ctaHref = contentString(c, "ctaHref");
  const ctaLabel = contentString(c, "ctaLabel");

  if (posts.length === 0) return null;

  return (
    <SectionShell {...props}>
      {/* The link sits on the heading line, the same as every product row. */}
      <div className="flex items-end justify-between gap-4">
        <div className="hidden flex-1 sm:block" aria-hidden="true" />
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          className="mb-0"
        />
        <div className="hidden flex-1 justify-end sm:flex">
          <ViewAllLink href={ctaHref} label={ctaLabel} on={props.section.background} />
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
        {posts.map((post, index) => {
          const body = (
            <>
              <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                <SafeImage src={post.image ?? ""} alt={post.title ?? ""} />
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
        align="left"
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
            <SafeImage
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
        />
        <div
          className={cn(
            "flex",
            hasHeading
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
                <SafeImage src={item.image} alt="" />
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
        <div className="mb-6 flex items-center justify-between gap-4">
          <SectionHeader
            overline={contentString(c, "overline")}
            title={contentString(c, "title")}
            align="left"
            className="mb-0 min-w-0"
          />
          <ViewAllLink
            href={contentString(c, "ctaHref")}
            label={contentString(c, "ctaLabel")}
            on={props.section.background}
          />
        </div>
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
              <SafeImage
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
              <SafeImage
                src={banner.image ?? ""}
                alt={alt}
                className="hidden lg:block"
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

function TileGridSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const tiles = renderableRows(parseListField(c, "tiles"));

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
      />
      <div className={cn("mt-6 grid gap-4 sm:gap-5", columnClass)}>
        {tiles.map((tile, index) => {
          const body = (
            <>
              <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
                <SafeImage src={tile.image ?? ""} alt={tile.label ?? ""} />
              </div>
              {tile.label ? (
                <p className="mt-2 text-center text-sm font-medium">{tile.label}</p>
              ) : null}
            </>
          );

          return tile.href ? (
            <Link
              key={`${tile.label}-${index}`}
              href={tile.href}
              className="group/tile"
            >
              {body}
            </Link>
          ) : (
            <div key={`${tile.label}-${index}`}>{body}</div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function WhyUsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
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

  if (items.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
      />
      <div className="mt-6 grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div
              key={`${item.title}-${index}`}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
                <Icon className="size-5" />
              </div>
              {item.title ? (
                <p className="font-heading font-semibold">{item.title}</p>
              ) : null}
              {item.description ? (
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionShell>
  );
}

function TestimonialsSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
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
      />
      <div className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-3">
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

function GallerySection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  /**
   * The shop's own photographs, or no grid.
   *
   * This rendered `galleryImages` — twelve stock Unsplash photos of somebody
   * else's cakes — as this shop's work, on every install, with no field to
   * change them. A customer choosing a bakery by its photographs was choosing
   * on someone else's.
   */
  const photos = limitRows(photoRows(c, "images"), contentNumber(c, "maxCount", 8));
  if (photos.length === 0) return null;
  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-6 grid gap-4 sm:gap-5 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((photo, index) => {
          const src = photo.image;
          // An untouched column is "" from the editor, not undefined, so `??`
          // could never fire and the object literal was always truthy: every
          // tile shipped alt="" and an empty white pill on hover.
          const title = photo.title?.trim() ?? "";
          const tag = photo.tag?.trim() ?? "";
          return (
            <figure
              key={`${src}-${index}`}
              className="group relative aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            >
              <OptimizedImage
                src={src}
                alt={title || `Gallery ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              {/* Shown, not revealed. This was invisible until a pointer
                  touched it, which is a caption a phone never saw at all. The
                  scrim is permanent now so the words stay readable. */}
              {title || tag ? (
                <figcaption className="absolute inset-0 flex flex-col justify-end bg-bakery-950/45 p-3">
                  {tag ? (
                    <span className="w-fit rounded-full bg-white/90 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-bakery-800 uppercase">
                      {tag}
                    </span>
                  ) : null}
                  {title ? (
                    <span className="mt-1.5 font-heading text-sm font-semibold text-white">
                      {title}
                    </span>
                  ) : null}
                </figcaption>
              ) : null}
            </figure>
          );
        })}
      </StaggerReveal>
      {/*
        ONLY WHEN THERE IS SOMEWHERE TO GO.

        This fell back to /store/gallery, and that page is gone — so without
        the guard the band draws a button to a 404. A shop that wants a
        view-all here gives it a link; until then there is no button, which
        is what every other rail on the page already does.
      */}
      {contentString(c, "ctaHref") && contentString(c, "ctaLabel") ? (
        <ScrollReveal className="mt-8 text-center">
          <Button variant="outline" render={<Link href={contentString(c, "ctaHref")} />}>
            {contentString(c, "ctaLabel")}
            <ArrowRight className="size-4" />
          </Button>
        </ScrollReveal>
      ) : null}
    </SectionShell>
  );
}

function FaqSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
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
          />
        </ScrollReveal>
        <ScrollReveal delay={100}>
          <Accordion className="mt-8 space-y-3">
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

function CtaSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const card = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10",
        props.embedded ? "flex h-full flex-col justify-center" : "mx-auto max-w-3xl"
      )}
    >
      <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
        {contentString(c, "overline")}
      </p>
      <h2 className="mt-3 font-heading text-xl font-bold sm:text-2xl">{contentString(c, "title")}</h2>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button render={<Link href={contentString(c, "ctaHref", routes.store.contact)} />}>
          {contentString(c, "ctaLabel", "Contact us")}
          <ArrowRight className="size-4" />
        </Button>
        {contentBoolean(c, "showPhone", true) && contentString(c, "phone") ? (
          <Button variant="outline" render={<a href={`tel:${contentString(c, "phone")}`} />}>
            <Phone className="size-4" />
            {contentString(c, "phone")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (props.embedded) return card;
  return <SectionShell {...props}>{card}</SectionShell>;
}

function PromoBannerSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 2);
  /**
   * The list is SELECTED here, not trusted from the caller.
   *
   * Both mounts pass `banners`, and they were passing different things. The
   * storefront pre-selects on the server (`selectActiveHeroBanners(raw,
   * "homepage")`, store-home-page.tsx) so the RSC payload carries only what a
   * visitor may see. The builder fetches GET /api/content/banners, which hands
   * staff the RAW stored array, and passed it straight in — so the preview that
   * calls itself "the same light sections as live store" rendered banners that
   * were switched off, expired, scheduled, scoped to Collections, or positioned
   * sidebar/popup, in stored order (newest first) rather than by priority. With
   * maxCount 2 that decided WHICH two tiles appeared, and the admin published a
   * homepage they had never seen.
   *
   * The server pass stays: it is the TRANSPORT filter, so unpublished content
   * does not cross the wire. This is the RENDER filter, and running it twice is
   * a no-op — the same rule testimonials and FAQs already follow above.
   */
  const banners = selectActiveHeroBanners(props.banners ?? [], "homepage").slice(0, maxCount);

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
      />
      <div className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-2">
        {banners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.link ?? contentString(c, "ctaHref", routes.store.collections)}
            className="group relative overflow-hidden rounded-2xl border border-border"
          >
            <div className="relative aspect-[21/9] bg-muted">
              <OptimizedImage src={banner.image} alt={banner.title} fill className="object-cover" sizes="50vw" />
              {/* The scrim stays — the words above it sit on a photograph and
                  need it to be readable. What went is its darkening under the
                  pointer, which was decoration. */}
              <div className="absolute inset-0 bg-bakery-950/35" />
              <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
                <p className="text-sm font-medium">{banner.title}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide">
                  {contentString(c, "ctaLabel", "Shop now")}
                  <ArrowRight className="size-3.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </SectionShell>
  );
}

function OffersSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
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
        />
        <p className="mt-8 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
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
      />
      <div className="mt-6 grid gap-4 sm:gap-5 md:grid-cols-3">
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

function InstagramSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 6);
  /**
   * The shop's own posts, or no strip.
   *
   * This rendered six stock photos as though they were the shop's feed — under
   * a heading naming the shop's REAL handle, with every tile linking to that
   * profile. So it invited a customer to a feed that looked nothing like the
   * pictures above it. There is no Instagram API here; these are photos the
   * shop uploads, and without them the section does not appear.
   */
  const posts = limitRows(photoRows(c, "posts"), maxCount);
  if (posts.length === 0) return null;
  // The section's own content wins when the admin has set it in the builder;
  // otherwise the shop's real Instagram from Settings → Social. The shipped
  // placeholders count as "not set" — they were seeded, not chosen, and a shop
  // that has configured its own profile should not keep advertising the demo
  // account across seven links and a "Follow @…" button.
  // The LEGACY value, kept verbatim on purpose. This is not a seed — the current
  // seed sets no handle at all. Its only job is to RECOGNISE the handle stored
  // on every homepage created before that change, so the shop's real profile
  // outranks it. Renaming it to something neutral silently disabled the
  // suppression and let the old handle win again, which is the opposite of what
  // this constant is for. It goes when no install still carries the value.
  const LEGACY_SEED_HANDLE = "monginisofficial";
  const SEED_URL = "https://instagram.com";
  const contentHandle = contentString(c, "instagramHandle");
  const contentUrl = contentString(c, "instagramUrl");
  const configured = props.instagram ?? null;

  // No final fallback to a handle: with nothing stored and nothing configured
  // this stays empty, and the section below renders no "Follow @…" button
  // rather than advertising an account that does not exist.
  const handle =
    (contentHandle && contentHandle !== LEGACY_SEED_HANDLE ? contentHandle : "") ||
    configured?.handle ||
    "";

  // Seven anchors below render this. It is builder-editable content, so it is
  // admin-typed text reaching an `href` exactly like `social[].href` was —
  // `javascript:` here is script execution on the homepage. Anything that is not
  // an http(s) URL falls back rather than being rendered.
  const preferredUrl =
    (contentUrl && contentUrl !== SEED_URL ? contentUrl : "") || configured?.url || contentUrl;
  const profileUrl = isSafeSocialUrl(preferredUrl) ? preferredUrl : SEED_URL;

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          // The legacy copy reads "@<legacy handle> — daily inspiration…", and
          /*
            THE SHOP'S OWN HANDLE, and nothing else.

            This read the section's Description with the handle as a
            fallback, and rewrote a seeded account name inside it. The
            Description box is gone from every section now, so a stored line
            here would render with nowhere to edit it — and what belongs
            under this heading was never prose anyway. Dropped entirely when
            there is no handle, rather than left as a bare "@".
          */
          description={handle ? `@${handle}` : ""}
        />
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {posts.map((post, index) => (
          <a
            key={`${post.image}-${index}`}
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative block aspect-square overflow-hidden rounded-2xl border border-border bg-cream-100"
            aria-label={handle ? `View @${handle} on Instagram` : "View our Instagram"}
          >
            <OptimizedImage
              src={post.image}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            />
          </a>
        ))}
      </StaggerReveal>
      {/* No handle means no account to follow. The button used to fall back to
          the seeded handle, so a shop with no Instagram invited its customers
          to follow somebody else's. */}
      {handle ? (
        <ScrollReveal className="mt-8 text-center">
          <Button variant="outline" render={<a href={profileUrl} target="_blank" rel="noopener noreferrer" />}>
            <Camera className="size-4" />
            Follow @{handle}
          </Button>
        </ScrollReveal>
      ) : null}
    </SectionShell>
  );
}

function NewsletterSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setLoading(true);

    // This form used to wait 600ms and say "Subscribed!" without writing
    // anything anywhere. Nobody was subscribed, and nobody could tell.
    const { persisted } = await addNewsletterSubscriber(email, "Homepage");
    setLoading(false);

    if (!persisted) {
      // Keep the address in the box so one tap retries it.
      toast.error("We couldn't sign you up", {
        description: "Please check your connection and try again.",
      });
      return;
    }

    toast.success("Subscribed!", {
      description: "You'll receive our sweetest updates.",
    });
    setEmail("");
  };

  const card = (
    <div
      className={cn(
        "rounded-2xl border border-border bg-cream-100 px-6 py-10 text-center sm:px-10",
        props.embedded ? "flex h-full flex-col justify-center" : "mx-auto max-w-3xl"
      )}
    >
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-card border border-border text-bakery-700">
        <Mail className="size-5" />
      </div>
      <h2 className="font-heading text-xl font-bold sm:text-2xl">{contentString(c, "title")}</h2>

      <form onSubmit={handleSubmit} className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row">
        <Input
          type="email"
          aria-label="Email address"
          placeholder="Enter your email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
          className="h-10 flex-1 bg-card"
        />
        <Button type="submit" variant="bakery" disabled={loading} className="h-10 shrink-0">
          <Send className="size-4" />
          {loading ? "Subscribing..." : contentString(c, "buttonLabel", "Subscribe")}
        </Button>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        {contentString(c, "disclaimer", "No spam. Unsubscribe anytime.")}
      </p>
    </div>
  );

  if (props.embedded) return card;
  return <SectionShell {...props}>{card}</SectionShell>;
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
    case "store-locator":
      return <StoreLocatorSection {...props} />;
    case "promo-banner":
      return <PromoBannerSection {...props} />;
    case "categories":
      return <CategoriesSection {...props} />;
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
    case "promo-collage":
      return <PromoCollageSection {...props} />;
    case "banner-grid":
      return <BannerGridSection {...props} />;
    case "banner-strip":
      return <BannerStripSection {...props} />;
    case "category-price-cards":
      return <CategoryPriceCardsSection {...props} />;
    case "tile-grid":
      return <TileGridSection {...props} />;
    case "seo-prose":
      return <SeoProseSection {...props} />;
    case "blog-cards":
      return <BlogCardsSection {...props} />;
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
    case "gallery":
      return <GallerySection {...props} />;
    case "instagram":
      return <InstagramSection {...props} />;
    case "faq":
      return <FaqSection {...props} />;
    case "newsletter":
      return <NewsletterSection {...props} />;
    case "cta":
      return <CtaSection {...props} />;
    default:
      return null;
  }
}
