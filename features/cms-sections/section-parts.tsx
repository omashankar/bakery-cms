import Link from "next/link";
import { SectionHeader } from "@/components/shared/section-header";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import type { LandingCategory, LandingOffer, LandingProduct } from "@/constants/landing-data";
import type { Banner } from "@/types/media";
import type { HomepageProductSource } from "@/features/products/lib/homepage-catalog";
import { layoutSpacing } from "@/constants/spacing";
import type { HomepageSectionInstance, SectionBackground, SectionAlign } from "@/types/homepage-builder";
import type { FaqItem, Testimonial } from "@/types/content";
import { cn } from "@/lib/utils";
import { resolveLabels, type ResolvedLabels } from "@/config/business-labels";

/**
 * What every homepage band is drawn from, shared by the renderer (which runs on
 * the SERVER for the storefront and in the browser for the builder preview)
 * and by the few bands that have to be client components. Kept out of the
 * renderer so that a client band importing them does not pull the whole
 * renderer — every section type — into the browser bundle with it.
 */

export interface HomepageSectionRendererProps {
  section: HomepageSectionInstance;
  /**
   * Whether this section is in the first screen of a phone.
   *
   * Every picture on the homepage was `loading="lazy"`, including the ones a
   * phone shows before any scrolling — so the largest one, the collage's first
   * tile, was not even requested until the layout had run, and it was the
   * page's LCP: 5.3s in Lighthouse's mobile run. Above the fold, the first
   * pictures load eagerly and the likely-largest one asks for high priority.
   */
  aboveTheFold?: boolean;
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
    /**
     * How long is left today, as the band would read it at the moment the
     * server rendered — or null when there is no window, or it has closed.
     *
     * THE BAND USED TO ARRIVE 900ms LATE. Its hook starts at null and fills
     * in from an effect, so 292px of it appeared after the page had painted
     * and pushed the homepage down: CLS 0.152 at 390, against a 0.1 budget.
     * Seeding the hook from this makes the band part of the HTML.
     *
     * It is a PROP, not a second reading of the clock, and that is what
     * keeps hydration quiet: the server’s render and the browser’s first
     * render use the identical string.
     *
     * ANOTHER HAND-WRITTEN COPY of a field on `StorefrontTrust` — see the
     * note on `sameDayCutoff` above for why this file cannot import it, and
     * why the two are edited together.
     *
     * OPTIONAL, for the same reason the note above gives: this object also
     * arrives as JSON from the builder’s preview endpoint, and a response
     * cached before this field existed comes without it. Absent simply means
     * the band fills in from the browser, as it did before.
     */
    sameDayTimeLeft?: string | null;
    rating: { count: number; average: number } | null;
  } | null;
  selected?: boolean;
  onSelect?: () => void;
  interactive?: boolean;
  /** Render only the inner card (no full-width section wrapper) so it can share a row. */
  embedded?: boolean;
  /**
   * The shop's wording ("Cakes", "Flowers"), resolved by whoever renders the
   * page: the storefront reads it on the server, the builder from its hook.
   * It was a hook call inside the bands, which kept the whole renderer a
   * client component — and its first render drew the DEFAULT words, swapped
   * for the shop's own a frame after hydration.
   */
  labels?: ResolvedLabels;
}

export function contentString(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback = ""
): string {
  const value = content[key];
  return typeof value === "string" ? value : fallback;
}

export function contentNumber(
  content: HomepageSectionInstance["content"],
  key: string,
  fallback: number
): number {
  const value = content[key];
  return typeof value === "number" ? value : Number(value) || fallback;
}

export function SectionShell({
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
export const VIEW_ALL_TONES: Partial<Record<SectionBackground, string>> = {
  "panel-rose": "bg-band-rose-strong",
  "panel-mint": "bg-band-mint-strong",
  "panel-sand": "bg-band-sand-strong",
  "panel-sky": "bg-band-sky-strong",
};

export function ViewAllLink({
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
export function SectionHeadingRow({
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

const DEFAULT_LABELS = resolveLabels({});

/** The wording a band uses: the caller's, or the neutral defaults. */
export function labelsOf(props: { labels?: ResolvedLabels }): ResolvedLabels {
  return props.labels ?? DEFAULT_LABELS;
}
