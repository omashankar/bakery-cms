"use client";

import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { SafeImage } from "@/components/shared/safe-image";
import {
  ArrowRight,
  Award,
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
import { useState } from "react";
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
function ViewAllLink({ href, label }: { href: string; label: string }) {
  if (!href || !label) return null;
  return (
    <Link
      href={href}
      className="shrink-0 rounded-md bg-cream-200 px-3.5 py-2 text-xs font-semibold tracking-wider text-foreground uppercase"
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

  /**
   * The shop's own promises, under its two delivery facts.
   *
   * Read here rather than inside `heroTrustBarFor` because
   * `builder-list-field-round-trip` slices THIS function's body to check that
   * every list field the hero declares is actually read by the component the
   * switch dispatches to — a read one call deeper passes the editor and fails
   * the guard, which is the point of the guard.
   */
  const promises = [
    ...(contentBoolean(section.content, "showDeliveryFacts", true)
      ? heroTrustBarFor(props.trust)
      : []),
    ...renderableRows(parseListField(props.section.content, "trust")),
  ];

  /**
   * The shop's own figures, in the band under the picture.
   *
   * There is no copy column to paint them in — the words are part of the
   * artwork — so they sit beside the promises underneath. They reached
   * nowhere at all for a while, which meant a shop that typed three figures
   * silently lost all three.
   */
  const stats = renderableRows(parseListField(props.section.content, "stats"));

  const carousel = <HeroCarousel slides={slides} copySide={copySide} />;

  const statsStrip =
    stats.length === 0 ? null : (
      <div className="flex flex-wrap items-baseline justify-center gap-x-10 gap-y-4 text-center">
        {stats.map((stat, index) => (
          <div key={`${stat.label}-${index}`}>
            {stat.value ? (
              <p className="font-heading text-2xl font-bold text-bakery-800 sm:text-3xl">
                {stat.value}
              </p>
            ) : null}
            {stat.label ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{stat.label}</p>
            ) : null}
          </div>
        ))}
      </div>
    );

  /**
   * The promises strip — the band under the hero.
   *
   * Null when there is nothing to say. That happens when the shop's commerce
   * settings are unreadable (the builder preview, every render) AND nobody has
   * written a promise: an empty bordered box is worse than no box.
   *
   * It carries no container of its own. The split hero already sits in one,
   * and nesting a second `max-w-7xl px-4` inside the first indents this band
   * past the carousel above it. The banner branch, which has no container to
   * inherit, adds one.
   */
  const promisesStrip =
    promises.length === 0 ? null : (
      <div
        className={cn(
          /*
            Two columns on a phone whatever the count — a four-across strip at
            360px gives each tile 80px, which is an icon and a truncated word.
            Wide enough to lay them out, the count decides, so two promises
            fill the band instead of leaving half of it empty. Written as
            whole class names rather than a style prop because Tailwind only
            emits the classes it can see.
          */
          "grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-border bg-cream-100 p-5 sm:gap-6 sm:p-6",
          promises.length === 1 && "grid-cols-1",
          promises.length === 2 && "lg:grid-cols-2",
          promises.length === 3 && "lg:grid-cols-3",
          promises.length >= 4 && "lg:grid-cols-4",
        )}
      >
        {promises.map((item, index) => {
          /*
            Falls back to a tick for an icon this build does not have. The
            value is a string off a Mongo document — an older name, a typo, a
            key from a build where the list was longer — and an undefined
            component in a JSX slot is not a blank space, it throws and takes
            the homepage with it.
          */
          const Icon =
            heroTrustIcons[item.icon as keyof typeof heroTrustIcons] ?? BadgeCheck;
          return (
            <div key={`${item.title}-${index}`} className="flex items-center gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-bakery-700 shadow-sm">
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                {item.subtitle ? (
                  <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );

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
  if (slides.length === 0 && promises.length === 0 && stats.length === 0) {
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
      {statsStrip || promisesStrip ? (
        <div className={cn(layoutSpacing.container, "mt-10 space-y-8 sm:mt-12")}>
          {statsStrip}
          {promisesStrip}
        </div>
      ) : null}
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
        description={contentString(c, "description")}
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
          "-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden",
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
  const description = contentString(c, "description");
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
            <p className="text-muted-foreground">{description}</p>
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
          description={contentString(c, "description")}
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
          description={contentString(c, "description")}
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
        THE ROW'S LINK SITS BESIDE ITS TITLE, not under its grid.

        It was a centred button below the cards, so a customer who had read
        the heading and decided they wanted more of THAT had to scroll past
        four products to find the way in. Every row in the reference puts
        VIEW ALL on the heading line, at the right-hand edge.

        The spacer opposite keeps the heading centred against the button
        rather than centred in the space left beside it — without it, a row
        with a link and a row without one sit their titles in different
        places, which reads as a mistake down a long page.
      */}
      <ScrollReveal>
        <div className="flex items-end justify-between gap-4">
          <div className="hidden flex-1 sm:block" aria-hidden="true" />
          <SectionHeader
            overline={contentString(c, "overline")}
            title={contentString(c, "title")}
            description={contentString(c, "description")}
            className="mb-0"
          />
          <div className="hidden flex-1 justify-end sm:flex">
            {props.showCta ? <ViewAllLink href={ctaHref} label={ctaLabel} /> : null}
          </div>
        </div>
      </ScrollReveal>
      <StaggerReveal className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {cakes.map((cake) => (
          <ProductCard key={cake.id} cake={cake} className="h-full" showAddToCart={false} showWishlist={false} />
        ))}
      </StaggerReveal>
      {/* The phone keeps it under the grid: there is no room beside a
          centred heading at that width, and a link nobody can reach is
          worse than one below the fold. */}
      {props.showCta && ctaHref && ctaLabel ? (
        <ScrollReveal className="mt-6 text-center sm:hidden">
          <Button variant="outline" render={<Link href={ctaHref} />}>
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Button>
        </ScrollReveal>
      ) : null}
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
function TabbedRailSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const tabs = renderableRows(parseListField(c, "tabs")).filter((tab) =>
    Boolean(tab.categorySlug),
  );
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

  if (tabs.length === 0) return null;

  const current = tabs[Math.min(active, tabs.length - 1)];
  const cakes = (props.categoryRails?.[current.categorySlug ?? ""] ?? []).slice(
    0,
    maxCount,
  );

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        {/*
          THE HEADING, THE TABS AND THE LINK ON ONE LINE.

          They were stacked and centred, which on a band whose heading is
          blank left a row of tabs floating alone in the middle of an empty
          strip. The layout this follows puts the three side by side: what
          the row is, what it can be switched to, and the way in.

          `flex-wrap`, so a phone stacks them rather than squeezing; and the
          heading goes back to ranged left, because a centred heading beside
          a left-hand row of tabs is neither.
        */}
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-3">
            <SectionHeader
              overline={contentString(c, "overline")}
              title={contentString(c, "title")}
              description={contentString(c, "description")}
              align="left"
              className="mb-0"
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
            */}
            <div className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {tabs.map((tab, index) => (
                <button
                  key={`${tab.label}-${index}`}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-pressed={index === active}
                  className={cn(
                    "relative shrink-0 rounded-md border px-4 py-2 text-sm font-semibold",
                    index === active
                      ? "border-bakery-950 bg-bakery-950 text-white"
                      : "border-border bg-card text-foreground"
                  )}
                >
                  {tab.label || tab.categorySlug}
                  {index === active ? (
                    <span
                      aria-hidden="true"
                      className="absolute -bottom-1 left-1/2 size-2 -translate-x-1/2 rotate-45 bg-bakery-950"
                    />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <ViewAllLink href={railCtaHref} label={railCtaLabel} />
        </div>
        {/* The rule the heading row sits on, as the layout draws it. */}
        <div className="mt-4 h-px bg-border" />
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
        <StaggerReveal className="mt-6 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          {cakes.map((cake) => (
            <ProductCard key={cake.id} cake={cake} className="h-full" showAddToCart={false} showWishlist={false} />
          ))}
        </StaggerReveal>
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
        description={contentString(c, "description")}
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
          description={contentString(c, "description")}
          className="mb-0"
        />
        <div className="hidden flex-1 justify-end sm:flex">
          <ViewAllLink href={ctaHref} label={ctaLabel} />
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
function BannerGridSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const banners = renderableRows(parseListField(c, "banners"));

  if (banners.length === 0) return null;

  return (
    <SectionShell {...props}>
      <SectionHeader
        overline={contentString(c, "overline")}
        title={contentString(c, "title")}
        align="left"
      />
      <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-15">
        {banners.map((banner, index) => {
          const wide = rowFlag(banner.wide);
          const box = cn(
            "relative block overflow-hidden rounded-2xl bg-muted",
            /*
              A RATIO EACH, so a row lines up whatever the shop exported.
              Without one the tallest picture sets the row height and the
              rest sit in a band of their own background.
            */
            wide ? "aspect-[11/10] lg:col-span-5" : "aspect-[2/3] lg:col-span-3",
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

  return (
    <SectionShell {...props}>
      {/*
        A CENTRED HEADING WITH THE LINK PINNED BESIDE IT.

        Centring the header and floating the link is what the layout does,
        and it only works while the link is out of the flow — inside it, the
        heading centres on the space LEFT OVER and sits visibly off-centre.
        Absolute from `sm` up, and below the heading on a phone, where
        there is no room beside it.
      */}
      <div className="relative mb-6">
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
          className="mb-0"
        />
        <div className="mt-4 flex justify-center sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:items-center">
          <ViewAllLink
            href={contentString(c, "ctaHref")}
            label={contentString(c, "ctaLabel")}
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
        description={contentString(c, "description")}
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
        description={contentString(c, "description")}
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
        description={contentString(c, "description")}
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
          description={contentString(c, "description")}
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
            description={contentString(c, "description")}
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
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        {contentString(c, "description")}
      </p>
      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button render={<Link href={contentString(c, "ctaHref", routes.store.contact)} />}>
          {contentString(c, "ctaLabel", "Contact Us")}
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
        description={contentString(c, "description")}
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
                  {contentString(c, "ctaLabel", "Shop Now")}
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
          description={contentString(c, "description")}
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
        description={contentString(c, "description")}
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
                Shop Now
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
          // that text is stored on every homepage created before this. Swapping
          // it at RENDER time keeps the admin's own words and their stored
          // content untouched, while a shop that has set its real Instagram
          // stops advertising the old account in prose. With no handle at all
          // the mention is dropped rather than replaced with a bare "@".
          description={contentString(c, "description", handle ? `@${handle}` : "").replaceAll(
            `@${LEGACY_SEED_HANDLE}`,
            handle ? `@${handle}` : ""
          )}
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
      <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
        {contentString(c, "description")}
      </p>
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
