import type { ResolvedLabels } from "@/config/business-labels";
/*
  `brandInfo` used to be imported here for the hero's shipped headline and
  subtext. Those are blank now — the demo brand's tagline was a claim about
  goods, published as whichever shop installs this — so nothing in this
  registry reaches into the demo shop's identity any more.
*/
import { demoPhotoIds, unsplash } from "@/constants/demo-images";
import { routes } from "@/constants/routes";
import type {
  HeroSlideContent,
  HomepageSectionInstance,
  HomepageSectionType,
  SectionBackground,
  SectionFieldDef,
} from "@/types/homepage-builder";

/**
 * Wording in this file that belongs to the SHOP, written as a token.
 *
 * This registry is plain data with no way to reach a setting, and six builder
 * fields read "Max cakes shown" while two section types were called "Featured
 * Cakes" and "Trending Cakes" — chrome the admin reads, in a builder a florist
 * uses. A token rather than a lookup keyed by the English literal, so that
 * editing the surrounding words cannot quietly disconnect the substitution, and
 * so a new section opts in by writing one.
 *
 * `defaultContent` is deliberately NOT resolved. That is the page copy a shop
 * then edits and stores; substituting into it would rewrite text an admin owns.
 */
const LABEL_TOKENS = {
  "{Products}": (l: RegistryLabels) => l.productWordPlural,
  "{products}": (l: RegistryLabels) => l.productWordPlural.toLowerCase(),
  "{Product}": (l: RegistryLabels) => l.productWord,
  "{product}": (l: RegistryLabels) => l.productWord.toLowerCase(),
} as const;

export type RegistryLabels = Pick<ResolvedLabels, "productWord" | "productWordPlural">;

function fillTokens(text: string, labels: RegistryLabels): string {
  let out = text;
  for (const [token, read] of Object.entries(LABEL_TOKENS)) {
    out = out.split(token).join(read(labels));
  }
  return out;
}

/** A registry entry with the shop’s own words in its CHROME. */
/**
 * The shop's live lists, for fields that ask to be filled from one.
 *
 * This module is plain data and cannot read a catalogue — which is exactly
 * why every category row in it is a hardcoded bakery slug. The caller that
 * CAN read one passes it in.
 */
export interface RegistryOptionSources {
  categories?: { id: string; name: string; slug: string }[];
}

/**
 * One field, with its tokens filled and its dynamic options resolved.
 *
 * Recursive because a LIST field's `itemFields` need the same treatment: a
 * tab's category picker is a select inside a list, and mapping only the top
 * level left it an empty dropdown with nothing anywhere to say why.
 *
 * A field keeps its own `options` if it has them, so this can never blank a
 * list somebody wrote by hand. With no source to draw on it resolves to an
 * empty dropdown, which is the honest answer for a shop with no categories.
 */
function withResolvedOptions(
  field: SectionFieldDef,
  labels: RegistryLabels,
  sources?: RegistryOptionSources,
): SectionFieldDef {
  return {
    ...field,
    label: fillTokens(field.label, labels),
    ...(field.itemFields
      ? {
          itemFields: field.itemFields.map((item) =>
            withResolvedOptions(item, labels, sources),
          ),
        }
      : {}),
    ...(field.optionsFrom === "categories"
      ? {
          options:
            field.options ??
            (sources?.categories ?? []).map((category) => ({
              label: category.name,
              // The SLUG, because that is what the rail is keyed by and what
              // the collection page resolves. An id would key a rail nothing
              // could look up.
              value: category.slug,
            })),
        }
      : {}),
  };
}

export function resolveRegistryEntry<T extends HomepageSectionRegistryEntry>(
  entry: T,
  labels: RegistryLabels,
  sources?: RegistryOptionSources,
): T {
  return {
    ...entry,
    label: fillTokens(entry.label, labels),
    fields: entry.fields.map((field) => withResolvedOptions(field, labels, sources)),
  };
}

export interface HomepageSectionRegistryEntry {
  type: HomepageSectionType;
  label: string;
  icon: string;
  defaultBackground: SectionBackground;
  defaultContent: Record<string, string | number | boolean>;
  fields: SectionFieldDef[];
}

/** Seed slides for a fresh hero carousel — all editable in the builder. */
/**
 * THREE PICTURES, AND NOT ONE WORD THE SHOP DID NOT WRITE.
 *
 * This shipped a sale, a service and a trade. Every install's homepage
 * opened on "Summer Celebration Sale / Up to 25% off our seasonal favourites
 * — this week only", then "Wedding Season Special / Book a tasting and design
 * a custom tiered cake", under a headline reading "Freshly baked, every day"
 * — a discount nobody was offering, a tasting nobody booked, and a trade the
 * shop may not be in. A customer reading a price off that page would have
 * been reading a number this software made up.
 *
 * They are blank now rather than replaced, because there is no sentence this
 * CMS can write on a shop's behalf that is true of every shop. Every one of
 * these fields is guarded at the render — the badge, headline and subtext
 * each draw nothing when empty (hero-carousel.tsx), and `primaryLabel` falls
 * back to the shop's OWN plural noun, so each slide keeps a working button
 * that names whatever this shop sells.
 *
 * The pictures stay: they are demo photographs, which is what a demo is for,
 * and a shop replaces them with its own.
 */
export const DEFAULT_HERO_SLIDES: HeroSlideContent[] = [
  {
    badge: "",
    headline: "",
    subtext: "",
    primaryLabel: "",
    primaryHref: routes.store.collections,
    secondaryLabel: "",
    secondaryHref: "",
    /*
      WIDE, because a hero can now be a full-bleed banner and a banner slide
      IS its picture. 800x1000 is portrait — it was cropped to the split
      hero's frame, and in a 3:1 band `object-cover` would keep a thin strip
      through the middle and throw the rest away.
    */
    imageUrl: unsplash(demoPhotoIds.blushCake, 1920, 640),
  },
  {
    badge: "",
    headline: "",
    subtext: "",
    primaryLabel: "",
    primaryHref: routes.store.collections,
    secondaryLabel: "",
    secondaryHref: "",
    imageUrl: unsplash(demoPhotoIds.chocolateCake, 1920, 640),
  },
  {
    badge: "",
    headline: "",
    subtext: "",
    primaryLabel: "",
    primaryHref: routes.store.collections,
    secondaryLabel: "",
    secondaryHref: "",
    imageUrl: unsplash(demoPhotoIds.weddingCake, 1920, 640),
  },
];

/**
 * Read hero slides from a section's content. Falls back to the legacy flat
 * fields (badge/headline/ctaPrimary…) so hero sections saved before the
 * multi-slide upgrade still render as a single slide.
 */
export function parseHeroSlides(
  content: Record<string, string | number | boolean>
): HeroSlideContent[] {
  const raw = content.slides;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (slide): slide is HeroSlideContent =>
            Boolean(slide) && typeof slide === "object"
        );
      }
    } catch {
      // fall through to legacy migration
    }
  }

  const headline = String(content.headline ?? "");
  const imageUrl = String(content.imageUrl ?? "");
  if (headline || imageUrl) {
    return [
      {
        badge: String(content.badge ?? ""),
        headline,
        subtext: String(content.subtext ?? ""),
        primaryLabel: String(content.ctaPrimaryLabel ?? ""),
        primaryHref: String(content.ctaPrimaryHref ?? ""),
        secondaryLabel: String(content.ctaSecondaryLabel ?? ""),
        secondaryHref: String(content.ctaSecondaryHref ?? ""),
        imageUrl,
      },
    ];
  }

  return [];
}

/**
 * Read a `type: "list"` field from a section's content.
 *
 * Stored as a JSON string for the same reason `slides` is: content values are
 * primitives, and `contentIsUsable` rejects anything else with a 400.
 *
 * Returns [] for anything it cannot read — an absent key, malformed JSON, a
 * value that is not an array. NEVER a default: these lists hold claims about
 * the shop, and a fallback would re-assert the demo copy on every section
 * saved before the field existed, which is the defect this exists to fix.
 *
 * A FAITHFUL read: rows come back exactly as stored, blanks and all.
 *
 * It used to drop all-empty rows and trim every value here, which broke the
 * editor in two ways. The editor holds no draft of its own — it re-reads
 * through this function on every render — so "Add row" wrote an empty row and
 * this filter deleted it before it could be typed into, making the button a
 * no-op on every list field. And clearing a row's last non-empty column
 * deleted the row out from under the cursor. Trimming did the same to a
 * trailing space, which a controlled input cannot then display.
 *
 * Deciding what is worth SHOWING belongs to the renderer, which is what
 * `renderableRows` below is for.
 */
export function parseListField(
  content: Record<string, string | number | boolean>,
  key: string,
): Record<string, string>[] {
  const raw = content[key];
  if (typeof raw !== "string" || !raw.trim()) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
      .map((row) => {
        const out: Record<string, string> = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === "string" ? v : v == null ? "" : String(v);
        }
        return out;
      });
  } catch {
    return [];
  }
}

/**
 * The rows a page should actually render.
 *
 * A row with nothing in any column says nothing, and an admin mid-edit leaves
 * exactly that behind. Storefront renderers filter here rather than in
 * `parseListField`, so the editor keeps its blank rows and the page does not
 * show them.
 */
export function renderableRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((row) => Object.values(row).some((value) => value.trim() !== ""));
}

/**
 * The rows of a PHOTO list worth rendering — those that have a photo.
 *
 * `renderableRows` keeps any row with one non-blank column, which is right for
 * a stat or a card but wrong for a picture: an admin who types the caption
 * "Priya's wedding tier" and is interrupted before choosing the image leaves a
 * row that passes it, and the row then reaches `<Image src="">` — a broken tile
 * sitting among the shop's real photographs. A row with no picture is not a
 * photograph, whatever else has been typed on it.
 */
export function photoRows(
  content: Record<string, string | number | boolean>,
  key: string,
): Record<string, string>[] {
  return parseListField(content, key).filter((row) => (row.image ?? "").trim() !== "");
}

/**
 * The first `max` rows, where a max of zero or less means "no limit".
 *
 * The builder's number input writes `Number(value) || 0`, so an admin who
 * selects "Max images shown" to retype it stores 0 mid-keystroke — and
 * `slice(0, 0)` is empty. On these sections empty means "render nothing", so
 * clearing that one box did not widen the gallery, it deleted the heading, the
 * photos and the CTA from the live page while the photo list stayed full.
 */
export function limitRows<T>(rows: T[], max: number): T[] {
  return max > 0 ? rows.slice(0, max) : rows;
}

export const HOMEPAGE_SECTION_REGISTRY: HomepageSectionRegistryEntry[] = [
  {
    type: "hero",
    label: "Hero",
    icon: "Sparkles",
    defaultBackground: "white",
    defaultContent: {
      slides: JSON.stringify(DEFAULT_HERO_SLIDES),
      /*
        The renderer falls back to this same word for a section that has no
        layout key — which is every hero stored before this existed, and
        nothing migrates them. This default only reaches sections created
        AFTER the deploy; the renderer's fallback is the half that keeps
        every existing shop's homepage where it was.
      */

      copySide: "left",
      /*
        TRUE, so nothing changes for a shop that already has this band.
        Turning it off from here would take a true and useful line off every
        existing homepage without anybody asking.
      */
      showDeliveryFacts: true,
    },
    fields: [
      {
        /*
          LEFT IS LISTED FIRST for the same reason split is: the editor shows
          `options[0]` for a section with no value and never writes it, so
          whatever sits first here is what an admin sees on every hero stored
          before this key existed.

          Banner only. The split hero's two columns are a grid, and the side
          its words are on is the grid's, not the shop's.
        */
        key: "copySide",
        label: "Banner words sit",
        type: "select",
        options: [
          { label: "On the left", value: "left" },
          { label: "On the right", value: "right" },
        ],
      },
      { key: "slides", label: "Hero slides", type: "slides" },
      {
        /**
         * The strip under the hero. It was a constant reading "1M+ Happy
         * customers · 500+ Cake varieties · 60+ Years of joy" — the demo
         * brand's figures, shown as whichever shop runs this CMS. Empty by
         * default, and an empty list renders no strip at all.
         */
        key: "stats",
        label: "Stats strip",
        type: "list",
        emptyHint: "No stats — the strip will not appear on the page.",
        itemFields: [
          { key: "value", label: "Figure", type: "text", placeholder: "500+" },
          {
            key: "label",
            label: "Label",
            type: "text",
            // A placeholder is an example, so it has to be an example any
            // shop could follow. "Cakes baked" is one only a bakery can.
            placeholder: "Orders delivered",
          },
        ],
      },
      {
        /*
          THE TWO FACTS ARE A CHOICE NOW, not an assumption.

          They are true — both are read from the shop's own commerce settings
          and track them — but true is not the same as wanted. A shop that
          carries its delivery terms in its banner artwork, or in the strip
          below, or simply does not want a band of promises under its hero,
          had no way to say so: the tiles appeared because the settings were
          readable, which is a decision this software was making for them.

          Off, the band draws only what the shop wrote in the list below —
          and nothing at all when that is empty.
        */
        key: "showDeliveryFacts",
        label: "Show your delivery facts",
        type: "boolean",
      },
      {
        /*
          THE BAR UNDER THE HERO, minus the two lines nobody wrote.

          It was four fixed tiles. Two read the shop's own settings — the
          free-delivery threshold and the delivery promise — and are facts,
          so they stay and are still derived. Two were claims: "100% Quality
          / Premium ingredients" and "Made with Love", asserted on behalf of
          whichever shop runs this CMS, about goods it may not even make, and
          with no box anywhere to change or remove them.

          They are gone. What a shop wants to promise beyond the two facts,
          it writes here. Empty is the honest starting state.
        */
        key: "trust",
        label: "Promises strip",
        type: "list",
        emptyHint: "Nothing added — only your delivery facts will show.",
        itemFields: [
          {
            key: "icon",
            label: "Icon",
            type: "select",
            options: [
              { label: "Van", value: "Truck" },
              { label: "Clock", value: "Clock" },
              { label: "Tick", value: "BadgeCheck" },
              { label: "Heart", value: "Heart" },
            ],
          },
          { key: "title", label: "Title", type: "text" },
          { key: "subtitle", label: "Line under it", type: "text" },
        ],
      },
    ],
  },
  {
    type: "our-menu",
    label: "Menu Strip",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "Explore",
      /*
        "Our Menu" over "cakes, pastries, chocolates, and more" — a list of a
        bakery's goods, published as the heading of whichever shop installs
        this. The tiles under it are read from the shop's OWN categories, so
        the heading naming a different trade's is the one part of this band
        that was never about the shop.

        The title says what the band does, in words true of any catalogue.
        The description is blank: the tiles are captioned already.
      */
      title: "Shop by category",
      description: "",
      maxCount: 8,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max categories shown", type: "number" },
    ],
  },
  {
    type: "promo-banner",
    label: "Promo Banner",
    icon: "Tag",
    defaultBackground: "cream",
    defaultContent: {
      /*
        A SALE NOBODY WAS RUNNING, shipped switched on.

        "Limited Time / Summer Celebration Sale / Up to 20% off on selected
        celebration cakes this week" is a discount, a season and a deadline,
        stated as the shop's on every install. A customer who came for that
        20% would have found it nowhere, because it never existed.

        The band draws the shop's own promo banners; blank copy above them
        renders no heading at all.
      */
      overline: "",
      title: "",
      description: "",
      ctaLabel: "",
      ctaHref: routes.store.collections,
      maxCount: 2,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "maxCount", label: "Max banners shown", type: "number" },
    ],
  },
  {
    /*
      ONE HEADING, SEVERAL TABS, ONE GRID.

      Three product rows down a long page are three scrolls apart. Tabbed,
      they are one band and a click, which is why the reference uses this
      shape more than once on the same page.

      Each tab names a CATEGORY the shop has, picked from its own list — so
      a plant shop's tabs are its own, not three cake words.

      Ships with no tabs. An empty band renders nothing.
    */
    type: "tabbed-rail",
    label: "Tabbed {products}",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      description: "",
      maxCount: 4,
      tabs: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} per tab", type: "number" },
      {
        key: "tabs",
        label: "Tabs",
        type: "list",
        emptyHint: "No tabs — this section will not appear on the page.",
        itemFields: [
          { key: "label", label: "Tab label", type: "text" },
          {
            key: "categorySlug",
            label: "Shows",
            type: "select",
            optionsFrom: "categories",
          },
        ],
      },
    ],
  },
  {
    /*
      THE COLLAGE. One band, several cards, each with its own everything.

      `promo-banner` next door pulls its pictures from the shared hero-banner
      pool, so two promo bands on one page show the same images and neither
      can carry a per-card subtitle or a per-card link. Every promo band in
      the reference is the opposite of that: the shop wrote each card.

      Ships EMPTY. A default card would be a claim about a shop nobody has
      made yet, and an empty list renders no band at all.
    */
    type: "promo-collage",
    label: "Promo cards",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      description: "",
      cards: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      {
        key: "cards",
        label: "Cards",
        type: "list",
        emptyHint: "No cards — this section will not appear on the page.",
        itemFields: [
          { key: "image", label: "Picture", type: "url", isImage: true },
          { key: "title", label: "Heading", type: "text" },
          { key: "subtitle", label: "Line under it", type: "text" },
          { key: "ctaLabel", label: "Button label", type: "text", placeholder: "Shop Now" },
          { key: "href", label: "Link", type: "url" },
          {
            /*
              The reference's Must Have band is three WIDE cards over a row
              of five small ones. Without this every card is the same size
              and the band is a plain grid.
            */
            key: "wide",
            label: "Full-width card",
            type: "boolean",
          },
        ],
      },
    ],
  },
  {
    /*
      A GRID OF PICTURE TILES the shop writes itself.

      The reference uses this shape twice — sixteen "Gift Categories" tiles
      and six country tiles under "International Gifts Delivery" — and
      neither is a catalogue category, so `categories` cannot express them:
      it is driven by the taxonomy and can only point at a category page.

      Ships empty, for the same reason the collage does.
    */
    type: "tile-grid",
    label: "Picture tiles",
    icon: "Grid3x3",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      description: "",
      columns: 4,
      tiles: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "columns", label: "Tiles per row", type: "number" },
      {
        key: "tiles",
        label: "Tiles",
        type: "list",
        emptyHint: "No tiles — this section will not appear on the page.",
        itemFields: [
          { key: "image", label: "Picture", type: "url", isImage: true },
          { key: "label", label: "Label", type: "text" },
          { key: "href", label: "Link", type: "url" },
        ],
      },
    ],
  },
  {
    /*
      SHIPS EMPTY, and that is the setting rather than an unfinished one.

      This band is a shop writing about its own trade, at whatever length it
      wants. Anything seeded here would publish as that shop's words on its
      own homepage without anybody writing them — and this CMS does not know
      what the shop sells, let alone what it would want to say about it.
    */
    type: "seo-prose",
    label: "About what you sell",
    icon: "Text",
    defaultBackground: "cream",
    defaultContent: {
      overline: "",
      title: "",
      blocks: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "blocks",
        label: "Paragraphs",
        type: "list",
        emptyHint: "Nothing written yet — this section will not appear on the page.",
        itemFields: [
          { key: "heading", label: "Heading", type: "text" },
          { key: "body", label: "Text", type: "textarea" },
        ],
      },
    ],
  },
  {
    type: "blog-cards",
    label: "From the blog",
    icon: "Newspaper",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      description: "",
      ctaLabel: "",
      ctaHref: "",
      posts: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "Link label", type: "text" },
      { key: "ctaHref", label: "Link", type: "url" },
      {
        key: "posts",
        label: "Articles",
        type: "list",
        emptyHint: "No articles — this section will not appear on the page.",
        itemFields: [
          { key: "image", label: "Picture", type: "url", isImage: true },
          { key: "title", label: "Headline", type: "text" },
          { key: "excerpt", label: "Standfirst", type: "textarea" },
          { key: "meta", label: "Date or byline", type: "text" },
          { key: "href", label: "Link", type: "url" },
        ],
      },
    ],
  },
  {
    type: "categories",
    label: "Featured Categories",
    icon: "LayoutGrid",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Browse by Occasion",
      title: "Featured Categories",
      description:
        "Find the perfect cake for every celebration — birthdays, weddings, anniversaries, and more.",
      maxCount: 6,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max categories shown", type: "number" },
    ],
  },
  {
    type: "featured-cakes",
    label: "Featured {Products}",
    icon: "Star",
    defaultBackground: "white",
    defaultContent: {
      overline: "Handpicked Favourites",
      /*
        The title named the trade and the description made three claims at
        once — "most loved", "premium ingredients", "decades of expertise" —
        about goods and a history this CMS knows nothing about. The heading
        that stays says only which row this is.
      */
      title: "Featured",
      description: "",
      maxCount: 4,
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      /*
        The way IN to more of this row.

        These three were the only product rows without one, so a customer who
        read "Best Sellers" and wanted more of exactly that had nowhere to go
        — while every category row beside them offered a link. Blank renders
        no button, so a shop that does not want one does not get one.
      */
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
    ],
  },
  {
    type: "trending",
    label: "Trending {Products}",
    icon: "TrendingUp",
    defaultBackground: "cream",
    defaultContent: {
      overline: "What's Hot",
      title: "Trending Now",
      // A claim about what everyone is talking about, for a shop with no
      // way to know and nothing behind the sentence.
      description: "",
      maxCount: 4,
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      // Same two the other rows carry — blank renders no button.
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
    ],
  },
  {
    type: "best-sellers",
    label: "Best Sellers",
    icon: "Award",
    defaultBackground: "white",
    defaultContent: {
      overline: "Customer Favourites",
      title: "Best Sellers",
      description: "Tried, tested, and loved by thousands of happy customers.",
      maxCount: 4,
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      // Same two the other rows carry — blank renders no button.
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
    ],
  },
  {
    type: "offers",
    label: "Special Offers",
    icon: "Tag",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Limited Time",
      title: "Special Offers",
      description: "Sweet deals you don't want to miss. Grab them before they're gone!",
      maxCount: 3,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max offers shown", type: "number" },
    ],
  },
  {
    type: "wedding",
    label: "Wedding Collection",
    icon: "Heart",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Forever Starts Here",
      title: "Wedding Collection",
      description:
        "Bespoke wedding cakes designed to make your special day unforgettable.",
      ctaLabel: "View Wedding Cakes",
      ctaHref: routes.store.weddingCakes,
      imageUrl:
        "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=900&h=900&fit=crop&q=80",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "imageUrl", label: "Image URL", type: "url", isImage: true },
    ],
  },
  {
    /*
      THE OPEN ROW. Every other product row in this registry is named after
      a bakery category — Photo Cakes, Eggless Cakes, Seasonal — so a plant
      shop opening Add Section was offered three rows it could never fill
      and none it could. Those stay for layouts already published; this is
      the one to reach for.

      Its copy ships EMPTY on purpose. A default title would be a claim
      about a category nobody has chosen yet, and `{Products}` would read
      as a heading rather than as the placeholder it is. The shop picks a
      category and writes its own line.
    */
    type: "category-rail",
    label: "{Products} by category",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      description: "",
      maxCount: 4,
      categorySlug: "",
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      {
        key: "categorySlug",
        label: "Category",
        type: "select",
        // Filled from the shop's own catalogue when the editor renders.
        optionsFrom: "categories",
      },
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "photo-cakes",
    label: "Photo Cakes",
    icon: "Camera",
    defaultBackground: "white",
    defaultContent: {
      overline: "Personalised",
      title: "Photo Cakes",
      // The section is a bakery one and keeps its name. The description was
      // still a claim about taste ("delicious") made in the shop's voice.
      description: "",
      maxCount: 4,
      ctaLabel: "Shop Photo Cakes",
      ctaHref: routes.store.collection("photo-cakes"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "eggless",
    label: "Eggless Cakes",
    icon: "Leaf",
    defaultBackground: "cream",
    defaultContent: {
      /*
        No claim in the copy this ships with.

        It read "100% Eggless" over a row that shows whatever the shop has
        filed under Eggless, and a description promising every cake was
        crafted without eggs — a guarantee the software made about FOOD, on
        every install, on the shop behalf. The title names the category; a
        shop that wants to promise more writes it here itself.
      */
      overline: "",
      title: "Eggless Collection",
      description: "",
      maxCount: 4,
      ctaLabel: "Shop Eggless",
      ctaHref: routes.store.collection("eggless"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "seasonal",
    label: "Seasonal Collection",
    icon: "Sun",
    defaultBackground: "white",
    defaultContent: {
      overline: "This Season",
      title: "Seasonal Collection",
      description: "Limited-edition flavours inspired by the season's finest ingredients.",
      maxCount: 4,
      ctaLabel: "Shop Seasonal",
      ctaHref: routes.store.collection("seasonal"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
    ],
  },
  {
    type: "why-us",
    label: "Why Choose Us",
    icon: "Shield",
    defaultBackground: "white",
    defaultContent: {
      // Seeded without the demo brand's name or its "six decades" — a new shop
      // should not have to delete someone else's history before it can write
      // its own.
      overline: "",
      title: "Why Choose Us",
      description: "",
    },
    fields: [
      {
        /**
         * The four cards were a hardcoded array inside the renderer: "Over six
         * decades of baking expertise", "Belgian chocolate", "Order by 2 PM for
         * same-day delivery across major cities". None of it is true of every
         * shop, and the delivery line contradicted the shop's own lead time.
         */
        key: "items",
        label: "Cards",
        type: "list",
        emptyHint: "No cards — this section will not appear on the page.",
        itemFields: [
          {
            key: "icon",
            label: "Icon",
            type: "select",
            options: [
              { label: "Award", value: "Award" },
              { label: "Leaf", value: "Leaf" },
              { label: "Truck", value: "Truck" },
              { label: "Palette", value: "Palette" },
            ],
          },
          { key: "title", label: "Title", type: "text", placeholder: "Premium Ingredients" },
          { key: "description", label: "Description", type: "text" },
        ],
      },
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    type: "testimonials",
    label: "Testimonials",
    icon: "Quote",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Love Letters",
      title: "What Our Customers Say",
      description: "Real stories from real celebrations across India.",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    type: "gallery",
    label: "Gallery",
    icon: "Images",
    defaultBackground: "white",
    defaultContent: {
      overline: "Sweet Inspiration",
      title: "Gallery",
      // The pictures are the shop's own; the sentence over them named a
      // trade that may not be.
      description: "",
      ctaLabel: "View Full Gallery",
      ctaHref: routes.store.gallery,
      // The homepage strip is a taste of the gallery, not the gallery. It used
      // to be a hardcoded `slice(0, 8)`; the photos are the shop's own list now
      // and the same list feeds /store/gallery, so without a cap here a shop
      // that curates forty photographs for its gallery page grows a forty-tile
      // block on its homepage whose own "View Full Gallery" button leads to the
      // very same forty.
      maxCount: 8,
    },
    fields: [
      {
        /**
         * The shop's OWN photographs.
         *
         * This grid rendered `galleryImages` from landing-data — twelve stock
         * Unsplash photos of somebody else's cakes, shown as this shop's work on
         * every install, with no field anywhere to change them. A customer
         * choosing a bakery by its photographs was choosing on someone else's.
         *
         * Empty renders no grid: a section that admits it has no photos yet is
         * better than one showing another bakery's.
         */
        key: "images",
        label: "Photos",
        type: "list",
        emptyHint: "No photos — this section will not appear on the page.",
        itemFields: [
          { key: "image", label: "Photo", type: "url", isImage: true },
          { key: "title", label: "Caption", type: "text" },
          { key: "tag", label: "Tag", type: "text", placeholder: "Wedding" },
        ],
      },
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "maxCount", label: "Max photos on the homepage", type: "number" },
    ],
  },
  {
    type: "instagram",
    label: "Instagram Gallery",
    icon: "Camera",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Follow Us",
      title: "On Instagram",
      description: "Daily inspiration and behind-the-scenes sweetness.",
      // No handle or URL seeded on purpose: left unset, the section uses the
      // shop's own Instagram from Settings → Social. Baking the demo account in
      // here meant a shop that had configured its real profile still advertised
      // someone else's across seven links and a "Follow @…" button.
      maxCount: 6,
    },
    fields: [
      {
        /**
         * The shop's own posts, if it wants to show any.
         *
         * This rendered six stock photos from `instagramPosts` as though they
         * were the shop's feed — under a heading naming the shop's real handle,
         * and each one linking to that profile. So the strip invited a customer
         * to a feed that looked nothing like the tiles above it.
         *
         * There is no Instagram API here and none is being added: these are
         * pictures the shop uploads, and the section disappears without them.
         */
        key: "posts",
        label: "Posts",
        type: "list",
        emptyHint: "No posts — this section will not appear on the page.",
        itemFields: [{ key: "image", label: "Photo", type: "url", isImage: true }],
      },
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "instagramHandle", label: "Instagram handle", type: "text" },
      { key: "instagramUrl", label: "Instagram URL", type: "url" },
      { key: "maxCount", label: "Max posts shown", type: "number" },
    ],
  },
  {
    type: "store-locator",
    label: "Store Locator",
    icon: "MapPin",
    defaultBackground: "cream",
    // Was "Find a Store Near You" / "Over 300 outlets across India" / "Find
    // Stores" — copy for a chain, shipped to every shop that installs this CMS,
    // above a locator that searched nothing and listed three fixed Mumbai
    // addresses. This CMS stores one address; the section shows it.
    defaultContent: {
      overline: "Visit Us",
      // The band shows the shop's one stored address. Naming the trade in
      // the heading above it is the only part that was not the shop's.
      title: "Visit Us",
      description: "Here is where to find us, and when we are open.",
      buttonLabel: "Get Directions",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
    ],
  },
  {
    type: "newsletter",
    label: "Newsletter",
    icon: "Mail",
    defaultBackground: "white",
    defaultContent: {
      title: "Stay in the Loop",
      // Promised exclusive offers, launches and seasonal specials — three
      // things no shop agreed to send. The box and its button say what it is.
      description: "",
      buttonLabel: "Subscribe",
      disclaimer: "No spam. Unsubscribe anytime.",
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "buttonLabel", label: "Button label", type: "text" },
      { key: "disclaimer", label: "Disclaimer", type: "text" },
    ],
  },
  {
    type: "cta",
    label: "Call to Action",
    icon: "Megaphone",
    defaultBackground: "white",
    defaultContent: {
      overline: "Get in Touch",
      // The question named the goods and called them perfect; the line under
      // it promised a team. Neither is this software's to say.
      title: "Ready to order?",
      description: "",
      ctaLabel: "Contact Us",
      ctaHref: routes.store.contact,
      showPhone: true,
      // Blank, not `contactInfo.phone`: this section stores its OWN copy of the
      // number, so seeding it from the shipped placeholder published a demo
      // 1800 line as a live `tel:` link on the homepage.
      phone: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "ctaLabel", label: "CTA label", type: "text" },
      { key: "ctaHref", label: "CTA link", type: "url" },
      { key: "showPhone", label: "Show phone button", type: "boolean" },
      { key: "phone", label: "Phone number", type: "text" },
    ],
  },
];

export function getRegistryEntry(
  type: HomepageSectionType
): HomepageSectionRegistryEntry | undefined {
  return HOMEPAGE_SECTION_REGISTRY.find((entry) => entry.type === type);
}

export function createDefaultHomepageSections(): HomepageSectionInstance[] {
  return HOMEPAGE_SECTION_REGISTRY.map((entry, index) => ({
    instanceId: `${entry.type}-${index}`,
    type: entry.type,
    order: index,
    isVisible: true,
    background: entry.defaultBackground,
    content: { ...entry.defaultContent },
  }));
}

export function createSectionInstance(
  type: HomepageSectionType,
  order: number
): HomepageSectionInstance {
  const entry = getRegistryEntry(type);
  if (!entry) {
    throw new Error(`Unknown section type: ${type}`);
  }
  return {
    instanceId: `${type}-${Date.now()}`,
    type,
    order,
    isVisible: true,
    background: entry.defaultBackground,
    content: { ...entry.defaultContent },
  };
}
