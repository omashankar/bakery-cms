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
import {
  weddingCakes,
  type LandingCategory,
  type LandingOffer,
  type LandingProduct,
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
import { heroCopySideOf, heroLayoutOf, heroSlidesFor } from "./lib/section-utils";
import type { HeroLayout, HomepageSectionInstance } from "@/types/homepage-builder";
import type { FaqItem, Testimonial } from "@/types/content";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  isWeddingEnabled,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
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
  const bgClass = section.background === "cream" ? "surface-cream" : "bg-white";
  // Hero runs its own entrance; the builder preview must stay fully visible while editing.
  // noReveal: the section reveals its own parts (e.g. staggered card grids).
  const revealOnScroll = !interactive && section.type !== "hero" && !noReveal;

  return (
    <section
      data-section-id={section.instanceId}
      onClick={interactive ? onSelect : undefined}
      className={cn(
        "scroll-mt-4 border-2 border-transparent transition-premium",
        bgClass,
        layoutSpacing.sectionY,
        /*
          A 2px TRANSPARENT BORDER IS STILL 2px OF PAGE.

          It exists so the builder's hover and selection outlines can appear
          without the section jumping — a fair trade inside a container, and
          invisible there. Around a band that runs to both edges of the
          window it is a white frame down each side of the picture, which is
          the one thing a full-bleed band must not have.

          Dropped only on the live page: the builder keeps the reserved 2px,
          because a section that cannot be outlined cannot be selected.
        */
        fullBleed && !interactive && "border-0",
        interactive && "cursor-pointer hover:border-bakery-200",
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
          {revealOnScroll ? <ScrollReveal>{children}</ScrollReveal> : children}
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

function HeroSection(props: HomepageSectionRendererProps) {
  const labels = useBusinessLabels();
  const { section } = props;

  const layout: HeroLayout = heroLayoutOf(section.content);
  const copySide = heroCopySideOf(section.content);

  const slides: HeroSlide[] = heroSlidesFor(
    layout,
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
   * The shop's own figures.
   *
   * Read once, here, because the two layouts show them in different places:
   * the split hero paints them inside its copy column, and a banner has no
   * copy column — the words are on the picture — so they go in the band
   * underneath beside the promises. They were reaching neither in the banner
   * before this, which meant a shop that typed three figures and then chose
   * the banner layout silently lost all three.
   */
  const stats = renderableRows(parseListField(props.section.content, "stats"));

  const carousel = (
    <HeroCarousel
      slides={slides}
      layout={layout}
      copySide={copySide}
      rating={props.trust?.rating ?? null}
      stats={stats}
    />
  );

  const statsStrip =
    layout !== "banner" || stats.length === 0 ? null : (
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
          "grid grid-cols-2 gap-x-4 gap-y-5 rounded-2xl border border-border bg-cream-50 p-5 sm:gap-6 sm:p-6",
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
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-bakery-700 shadow-sm">
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
   * The banner drops every slide that has no picture, and a shop switching to
   * the banner layout BEFORE uploading wide artwork is the ordinary order of
   * events — so zero slides is a real state, not a corner. With the padding
   * cancelled below it would draw as a 4px line of nothing across the top of
   * the homepage.
   *
   * The builder says so instead of vanishing, the way every other empty
   * section in this file does.
   */
  if (slides.length === 0 && promises.length === 0 && stats.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground sm:p-8">
          {layout === "banner"
            ? "This hero is set to the full-bleed banner, and a banner slide is its picture — add an image to a slide and it will appear here."
            : "Nothing is set on this hero yet. Add a slide with a headline or an image."}
        </div>
      </SectionShell>
    );
  }

  if (layout === "banner") {
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
        className="py-0 pb-8 sm:py-0 sm:pb-10 lg:py-0 lg:pb-14"
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

  return (
    <SectionShell {...props} className="py-10 sm:py-12 lg:py-16">
      {carousel}
      {/* The margin rides the strip, not a wrapper: an empty div with 40px of
          top margin is still 40px of nothing between the hero and the page. */}
      {promisesStrip ? <div className="mt-10 sm:mt-12">{promisesStrip}</div> : null}
    </SectionShell>
  );
}

function OurMenuSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const maxCount = contentNumber(c, "maxCount", 8);
  const items = (props.categories ?? getHomepageCategories(maxCount)).slice(0, maxCount);

  if (items.length === 0) return null;

  return (
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
          */
          "mt-8 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:gap-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden",
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
            className="group flex w-[5.5rem] shrink-0 snap-start flex-col rounded-2xl border border-border bg-gradient-to-b from-cream-50 to-white p-2 transition-premium hover:border-bakery-300 hover:shadow-sm sm:w-auto sm:p-3"
          >
            {/*
              A ROUNDED SQUARE, not a circle.

              A circle crops a product photograph to its middle — a bouquet
              loses its stems, a boxed gift loses its corners — and the
              reference strip is squares for exactly that reason.

              INSET, so the card's own tint frames the picture rather than the
              picture being the card. That is what the reference shows, and it
              is what makes a cut-out product image — the kind with no
              background of its own — read as sitting ON the tile instead of
              floating in a white void.
            */}
            <div className="relative aspect-square w-full overflow-hidden rounded-xl">
              {category.image ? (
                <OptimizedImage
                  src={category.image}
                  alt={category.name}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
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
            <p className="line-clamp-2 px-1 pt-2.5 pb-1 text-center text-xs font-semibold text-foreground group-hover:text-bakery-700 sm:text-sm">
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
        <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground sm:p-8">
          This section shows your shop&apos;s address and opening hours from
          Settings → Contact. Until you set a real address there it stays hidden
          on the live homepage — the shipped example address is in Mumbai.
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      <div className="grid gap-8 rounded-2xl border border-border bg-white p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div className="space-y-5">
          <div className="flex size-12 items-center justify-center rounded-xl bg-cream-100 text-bakery-700">
            <MapPin className="size-5" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-widest text-bakery-700 uppercase">
              {contentString(c, "overline")}
            </p>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold">{title}</h2>
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
          <div className="flex items-start gap-3 rounded-xl border border-border bg-cream-50 p-4">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-bakery-700">
              <Store className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-medium text-foreground">{location.address}</p>
              {location.phone ? (
                <a
                  href={`tel:${location.phone.replace(/\s+/g, "")}`}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-bakery-700"
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
            <div className="rounded-xl border border-border bg-cream-50 p-4">
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
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {items.map((category) => (
          <Link
            key={category.id}
            href={routes.store.collection(category.slug)}
            className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white transition-all duration-300 hover:border-bakery-300 hover:shadow-md"
          >
            <div className="relative aspect-[4/3] bg-muted">
              {category.image ? (
                <OptimizedImage src={category.image} alt={category.name} fill className="object-cover" sizes="300px" />
              ) : null}
            </div>
            <div className="p-4">
              <p className="font-medium">{category.name}</p>
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
        <div className="mt-8 rounded-2xl border border-dashed border-border bg-white p-6 text-center text-sm text-muted-foreground sm:p-8">
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
            {props.showCta && ctaHref && ctaLabel ? (
              <Button variant="outline" size="sm" render={<Link href={ctaHref} />}>
                {ctaLabel}
                <ArrowRight className="size-4" />
              </Button>
            ) : null}
          </div>
        </div>
      </ScrollReveal>
      <StaggerReveal className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {cakes.map((cake) => (
          <ProductCard key={cake.id} cake={cake} className="h-full" />
        ))}
      </StaggerReveal>
      {/* The phone keeps it under the grid: there is no room beside a
          centred heading at that width, and a link nobody can reach is
          worse than one below the fold. */}
      {props.showCta && ctaHref && ctaLabel ? (
        <ScrollReveal className="mt-8 text-center sm:hidden">
          <Button variant="outline" render={<Link href={ctaHref} />}>
            {ctaLabel}
            <ArrowRight className="size-4" />
          </Button>
        </ScrollReveal>
      ) : null}
    </SectionShell>
  );
}

const weddingPerks = [
  { icon: Palette, label: "Custom themes & colours" },
  { icon: Award, label: "Multi-tier showpieces" },
  { icon: Heart, label: "Tasting before you book" },
] as const;

function WeddingSection(props: HomepageSectionRendererProps) {
  // Wedding is bakery-only. Default to shown so SSR / bakery render unchanged,
  // then hide after mount for other business types / when the module is off.
  const [weddingEnabled, setWeddingEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setWeddingEnabled(isWeddingEnabled());
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  const c = props.section.content;
  const showcase = weddingCakes[0];
  /**
   * Never set, versus cleared on purpose — two different things.
   *
   * The key being absent means the section was created before it had an image
   * field, so the showcase photo stands in. The key being present and empty is
   * the "Clear image" button in the media field, and it has to mean cleared:
   * falling back there would put a stock Unsplash cake back on the live homepage
   * the moment an admin removed the demo photo, which is the opposite of what
   * they asked for.
   */
  const storedImage = c.imageUrl;
  const teaserImage =
    typeof storedImage === "string" ? storedImage.trim() : showcase?.image ?? "";

  if (!weddingEnabled) return null;

  // No background class below. This section hardcoded `surface-cream` while its
  // stored setting said "white", so the Background dropdown read White, the page
  // and the preview rendered cream, and changing the dropdown did nothing.
  return (
    <div className="contents" data-gate-wedding>
    <SectionShell {...props} noReveal>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <ScrollReveal className="space-y-6">
          <Badge variant="accent" className="gap-1.5 rounded-full px-3.5 py-1.5 text-[13px]">
            <Heart className="size-3.5" />
            {contentString(c, "overline", "Wedding Collection")}
          </Badge>
          <div className="space-y-4">
            <h2 className="font-heading text-3xl font-bold leading-tight text-bakery-950 sm:text-4xl">
              {contentString(c, "title")}
            </h2>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              {contentString(c, "description")}
            </p>
          </div>
          <ul className="grid gap-3">
            {weddingPerks.map((perk) => {
              const Icon = perk.icon;
              return (
                <li key={perk.label} className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-bakery-700 shadow-sm">
                    <Icon className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-foreground">{perk.label}</span>
                </li>
              );
            })}
          </ul>
          <Button
            size="lg"
            className="rounded-xl"
            render={<Link href={contentString(c, "ctaHref", routes.store.weddingCakes)} />}
          >
            {contentString(c, "ctaLabel", "View Wedding Cakes")}
            <ArrowRight className="size-4" />
          </Button>
        </ScrollReveal>

        <ScrollReveal delay={120} className="relative mx-auto w-full max-w-lg lg:max-w-none">
          <div className="rounded-[2rem] border border-border bg-white p-2.5 shadow-md">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-cream-100 sm:aspect-[4/3] lg:aspect-square">
              {/* An empty string is a string, so `contentString`'s fallback never
                  fired for a CLEARED field — and the media field's "Clear image"
                  button sets exactly that. The result was `src=""`: next/image
                  does not throw, it just ships an empty grey panel to every
                  visitor. The wedding renderer's twin guards this the same way. */}
              {teaserImage ? (
                <OptimizedImage
                  src={teaserImage}
                  alt="Wedding cake"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
                  {props.interactive ? "Choose an image for this section." : null}
                </div>
              )}
            </div>
          </div>
          {/* A floating card used to sit here naming a specific cake, quoting a
              specific price and awarding it five filled stars — all three read
              from the hardcoded `weddingCakes[0]`, not from the catalogue and not
              from any review. The price never followed the product: an admin who
              repriced that cake still had the old figure on their homepage, with
              no field anywhere in the builder to correct it. The teaser links to
              the wedding page, where the real cakes carry their real prices. */}
        </ScrollReveal>
      </div>
    </SectionShell>
    </div>
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

  if (tabs.length === 0) return null;

  const current = tabs[Math.min(active, tabs.length - 1)];
  const cakes = (props.categoryRails?.[current.categorySlug ?? ""] ?? []).slice(
    0,
    maxCount,
  );

  return (
    <SectionShell {...props} noReveal>
      <ScrollReveal>
        <SectionHeader
          overline={contentString(c, "overline")}
          title={contentString(c, "title")}
          description={contentString(c, "description")}
          className="mb-0"
        />
        {/*
          The tabs sit under the heading and scroll sideways rather than
          wrapping: four tabs on a phone wrap to two lines and move the grid
          down the page every time one is pressed.
        */}
        <div className="mt-6 flex justify-center">
          <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-cream-50 p-1">
            {tabs.map((tab, index) => (
              <button
                key={`${tab.label}-${index}`}
                type="button"
                onClick={() => setActive(index)}
                aria-pressed={index === active}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-premium",
                  index === active
                    ? "bg-white text-bakery-700 shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label || tab.categorySlug}
              </button>
            ))}
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
        <StaggerReveal className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {cakes.map((cake) => (
            <ProductCard key={cake.id} cake={cake} className="h-full" />
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
      <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card, index) => {
          const body = (
            <>
              {card.image ? (
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
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
            "overflow-hidden rounded-xl border border-border bg-white transition-all duration-300 hover:border-bakery-300 hover:shadow-md",
            // A card with no link is still a card. The reference's SALE
            // banner is artwork, not a destination.
            card.wide ? "sm:col-span-2" : "",
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
      <div className={cn("mt-8 grid gap-4", columnClass)}>
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
              className="group/tile transition-premium hover:opacity-90"
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
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => {
          const Icon = whyIcons[item.icon as keyof typeof whyIcons] ?? Award;
          return (
            <div
              key={`${item.title}-${index}`}
              className="rounded-xl border border-border bg-white p-5 transition-all duration-300 hover:border-bakery-300 hover:shadow-md"
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
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="flex flex-col rounded-xl border border-border bg-white p-6 transition-all duration-300 hover:border-bakery-300 hover:shadow-md"
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
      <StaggerReveal className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
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
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              />
              {title || tag ? (
                <figcaption className="absolute inset-0 flex flex-col justify-end bg-bakery-950/0 p-3 opacity-0 transition-all duration-300 group-hover:bg-bakery-950/45 group-hover:opacity-100">
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
      <ScrollReveal className="mt-8 text-center">
        <Button variant="outline" render={<Link href={contentString(c, "ctaHref", routes.store.gallery)} />}>
          {contentString(c, "ctaLabel", "View Gallery")}
          <ArrowRight className="size-4" />
        </Button>
      </ScrollReveal>
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
                className="overflow-hidden rounded-2xl border border-border bg-white transition-colors hover:border-bakery-300"
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
      <h2 className="mt-3 font-heading text-3xl font-bold sm:text-4xl">{contentString(c, "title")}</h2>
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
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {banners.map((banner) => (
          <Link
            key={banner.id}
            href={banner.link ?? contentString(c, "ctaHref", routes.store.collections)}
            className="group relative overflow-hidden rounded-2xl border border-border"
          >
            <div className="relative aspect-[21/9] bg-muted">
              <OptimizedImage src={banner.image} alt={banner.title} fill className="object-cover" sizes="50vw" />
              <div className="absolute inset-0 bg-bakery-950/35 transition-colors group-hover:bg-bakery-950/45" />
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
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {offers.map((offer) => (
          <article
            key={offer.id}
            className="overflow-hidden rounded-xl border border-border bg-white"
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
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-bakery-950/0 transition-all duration-300 group-hover:bg-bakery-950/45">
              <Camera className="size-6 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            </div>
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
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-white border border-border text-bakery-700">
        <Mail className="size-5" />
      </div>
      <h2 className="font-heading text-3xl font-bold sm:text-4xl">{contentString(c, "title")}</h2>
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
          className="h-10 flex-1 bg-white"
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
    case "tile-grid":
      return <TileGridSection {...props} />;
    case "offers":
      return <OffersSection {...props} />;
    case "wedding":
      return <WeddingSection {...props} />;
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
