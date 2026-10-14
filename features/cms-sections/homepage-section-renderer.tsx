import { OptimizedImage } from "@/components/shared/optimized-image";
import Link from "next/link";
import { BadgeCheck, Clock, Heart, Quote, Star, Tag, Truck } from "lucide-react";
import { ProductCard } from "@/components/storefront/product-card";
import { SectionHeader, sectionHeaderDraws } from "@/components/shared/section-header";
import { RatingStars } from "@/components/shared/rating-stars";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { FaqList } from "@/components/shared/faq-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LandingCategory, LandingProduct } from "@/constants/landing-data";
import { routes } from "@/constants/routes";
import { parseHeroSlides, parseListField, renderableRows, rowFlag } from "@/constants/section-registry";
import { HeroCarousel, type HeroSlide } from "./hero-carousel";
import { getStorefrontFaqs, getStorefrontTestimonials, selectStorefrontFaqs, selectStorefrontTestimonials } from "@/features/content/lib/storefront-content";
import { getHomepageProducts, type HomepageProductSource, getHomepageCategories, getHomepageOffers } from "@/features/products/lib/homepage-catalog";
import { heroCopySideOf, heroSlidesFor, sectionAlignOf } from "./lib/section-utils";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";
import { type HomepageSectionRendererProps, labelsOf, contentString, contentNumber, SectionShell, ViewAllLink, SectionHeadingRow } from "./section-parts";
import { ScrollStrip } from "./scroll-strip";
import { TabbedRailTabs } from "./tabbed-rail-tabs";
import { BannerStripSection } from "./banner-strip-section";
import { SameDayCountdownSection } from "./same-day-countdown-section";
import { RecentlyViewedSection } from "./recently-viewed-section";

export type { HomepageSectionRendererProps } from "./section-parts";

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
    {
      icon: "Clock",
      title: trust.deliveryPromise,
      // The cutoff the checkout enforces, when the shop has one open today.
      subtitle: trust.sameDayCutoff ? `Order by ${trust.sameDayCutoff}` : "",
    },
  ];
}

const heroTrustIcons = { Truck, Clock, BadgeCheck, Heart, Star } as const;

function HeroSection(props: HomepageSectionRendererProps) {
  const labels = labelsOf(props);
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
        {items.map((category, index) => (
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
            className="group flex w-[5.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-border/70 bg-cream-100 bg-gradient-to-b from-card to-bakery-100 shadow-xs transition-shadow hover:shadow-md sm:w-auto"
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
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  /*
                    120px was only ever right in the eight-across case. At a
                    1023px viewport the four-column grid paints these at about
                    225px, so the browser was asked for a source under half
                    the painted width and every tablet got soft tiles.
                  */
                  sizes="(min-width: 1024px) 160px, (min-width: 640px) 25vw, 88px"
                  loading={props.aboveTheFold && index < 4 ? "eager" : "lazy"}
                />
              ) : null}
            </div>
            {/*
              ITS OWN PADDING, because the card no longer has any. This read
              `px-1 pt-2.5 pb-1` and leaned on the card's 8/12px for the rest
              — with that gone the name would have touched three edges.
            */}
            {/* Bold and a size up, as the reference sets it: the name is the tile's
                only words, so it can carry weight without competing. */}
            <p className="line-clamp-2 px-2 pt-2.5 pb-3 text-center text-[13px] font-bold text-foreground sm:text-base">
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
  const labels = labelsOf(props);
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
              framed
            />
          ))}
        </ScrollStrip>
      </div>
    </SectionShell>
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

  /**
   * EVERY TAB'S ROW, drawn here; `TabbedRailTabs` only chooses which shows.
   *
   * The chosen tab used to be state in this function, which made the whole
   * renderer a client component and every band on the homepage hydrate.
   */
  const panels = tabs.map((tab, index) => {
    const slug = tab.categorySlug ?? "";
    const pool = source
      ? (props.flaggedCategoryRails?.[source as HomepageProductSource]?.[slug] ?? [])
      : (props.categoryRails?.[slug] ?? []);
    const cakes = pool.slice(0, maxCount);

    return cakes.length === 0 ? (
      /*
        A tab whose category holds nothing says so, rather than collapsing
        the band — the tabs beside it still work, and a customer who
        pressed this one needs to know the press landed.
      */
      <p key={index} className="mt-8 text-center text-sm text-muted-foreground">
        Nothing here yet.
      </p>
    ) : (
      <div key={index} className="mt-6">
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
              framed
            />
          ))}
        </ScrollStrip>
      </div>
    );
  });

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
        <TabbedRailTabs
          tabLabels={tabs.map((tab) => tab.label || tab.categorySlug || "")}
          inlineHeading={
            align === "left" ? (
              <SectionHeader
                overline={contentString(c, "overline")}
                title={contentString(c, "title")}
                className="mb-0 shrink-0 pb-0 sm:pb-2.5"
                align="left"
              />
            ) : null
          }
          link={
            <ViewAllLink href={railCtaHref} label={railCtaLabel} on={props.section.background} />
          }
          panels={panels}
        />
      </ScrollReveal>
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
              // The first row is on a phone's first screen; see `aboveTheFold`.
              loading={props.aboveTheFold && index < 2 ? "eager" : "lazy"}
              fetchPriority={props.aboveTheFold && index === 0 ? "high" : "auto"}
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

/**
 * THE SHOP'S PROMISES — its rating, its free-delivery threshold and how soon
 * it delivers — as one strip the builder can place anywhere.
 *
 * All three are read from the shop's own data, never written here: the
 * rating from its approved reviews (and absent until there is one), the
 * threshold and the delivery promise from its commerce settings (see
 * `heroTrustBarFor`). They used to be strips inside the hero; the shop took
 * them off the hero and, a month later, asked for them back on the page —
 * so they are a band of their own now, placed and hidden from the builder.
 */
function ShopPromisesSection(props: HomepageSectionRendererProps) {
  const c = props.section.content;
  const show = (key: string) => c[key] !== false && c[key] !== "false";
  const trust = props.trust;

  const items: { icon: keyof typeof heroTrustIcons; title: string; subtitle: string }[] = [];
  if (show("showRating") && trust?.rating && trust.rating.count > 0) {
    items.push({
      icon: "Star",
      title: `${trust.rating.average.toFixed(1)} rating`,
      subtitle: `From ${trust.rating.count} ${trust.rating.count === 1 ? "review" : "reviews"}`,
    });
  }
  for (const tile of heroTrustBarFor(trust)) {
    const key = tile.icon === "Truck" ? "showFreeDelivery" : "showDelivery";
    if (!show(key) || !tile.title) continue;
    items.push({
      icon: (tile.icon as keyof typeof heroTrustIcons) ?? "BadgeCheck",
      title: tile.title,
      subtitle: tile.subtitle ?? "",
    });
  }

  if (items.length === 0) {
    if (!props.interactive) return null;
    return (
      <SectionShell {...props}>
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing to show yet: the rating appears once a review is approved, and the delivery
          facts come from Settings → Commerce.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell {...props}>
      {/*
        A TINTED STRIP WITH RINGED ICONS, as the reference draws its promises:
        it reads as one band of reassurance rather than a form-like box. On a
        phone the facts sit side by side, icon over words — stacked, three of
        them took ~180px of the first screen.
      */}
      <ul
        className={cn(
          "grid gap-3 rounded-2xl bg-cream-100 px-3 py-5 sm:gap-6 sm:px-8 sm:py-6",
          items.length === 1 ? "grid-cols-1" : items.length === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {items.map((item) => {
          const Icon = heroTrustIcons[item.icon] ?? BadgeCheck;
          return (
            <li
              key={item.title}
              className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-center sm:gap-3 sm:text-left"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-bakery-700 shadow-sm ring-2 ring-bakery-200 sm:size-14">
                <Icon
                  aria-hidden="true"
                  className={cn("size-5 sm:size-6", item.icon === "Star" && "fill-amber-400 text-amber-500")}
                />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold leading-snug text-foreground sm:text-base">
                  {item.title}
                </span>
                {item.subtitle ? (
                  <span className="block text-xs leading-snug text-muted-foreground sm:text-sm">
                    {item.subtitle}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
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
          <FaqList
            name={`faq-${props.section.instanceId}`}
            items={items.slice(0, maxItems)}
            openFirst={0}
            className={cn(hasHeading && "mt-8", "space-y-3")}
            itemClassName="overflow-hidden rounded-2xl border border-border bg-card transition-colors"
            questionClassName="px-5 py-4 font-heading font-semibold"
            answerClassName="px-5 pb-4 leading-relaxed text-muted-foreground"
          />
        </ScrollReveal>
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

/**
 * What a CLIENT band is handed: the band itself and how the builder is
 * driving it, and nothing else. Spreading every prop would serialise all of
 * the page's product rails into each one's payload for the browser.
 */
function shellPropsOf(props: HomepageSectionRendererProps): HomepageSectionRendererProps {
  return {
    section: props.section,
    aboveTheFold: props.aboveTheFold,
    selected: props.selected,
    onSelect: props.onSelect,
    interactive: props.interactive,
    embedded: props.embedded,
    labels: props.labels,
  };
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
      return <BannerStripSection {...shellPropsOf(props)} />;
    case "shop-promises":
      return <ShopPromisesSection {...props} />;
    case "same-day-countdown":
      return <SameDayCountdownSection {...shellPropsOf(props)} trust={props.trust} />;
    case "category-price-cards":
      return <CategoryPriceCardsSection {...props} />;
    case "tile-grid":
      return <TileGridSection {...props} />;
    case "blog-cards":
      return <BlogCardsSection {...props} />;
    case "recently-viewed":
      return <RecentlyViewedSection {...shellPropsOf(props)} catalog={props.catalog} />;
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
