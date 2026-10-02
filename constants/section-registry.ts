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
/**
 * THE SHOP'S WORD, STARTING A LABEL.
 *
 * `{Products}` returned the plural AS TYPED, which read as a bug the moment a
 * shop typed its own word in lower case: "products by category" at the head
 * of a picker whose every other row is Title Case. The token pair is
 * `{Products}` and `{products}`, and the lower one calls `.toLowerCase()`
 * outright — so the upper one was always meant to be the capitalised half.
 *
 * ONLY WHEN THE WHOLE WORD IS LOWER CASE. A shop selling iPhones types
 * "iPhones", and upper-casing the first letter unconditionally gives
 * "IPhones" — a worse answer than the one being fixed. A word that already
 * carries a capital anywhere is a word the shop has cased deliberately.
 */
function startsALabel(word: string): string {
  if (word !== word.toLowerCase()) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}
const LABEL_TOKENS = {
  "{Products}": (l: RegistryLabels) => startsALabel(l.productWordPlural),
  "{products}": (l: RegistryLabels) => l.productWordPlural.toLowerCase(),
  "{Product}": (l: RegistryLabels) => startsALabel(l.productWord),
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
  /**
   * WHY THIS SECTION IS NOT OFFERED IN "Add section". Absent means offered.
   *
   * It hides the row from the PICKER and nothing else. The registry keeps
   * every entry, because `getRegistryEntry` searches all of it and that is how
   * the builder resolves the fields of a section already on a page — or on a
   * revision somebody restores from History. Filter the registry instead and
   * those sections render with no editor behind them.
   *
   * A STRING RATHER THAN A FLAG, because there are two different reasons and a
   * boolean hides that. Two entries are bakery slugs frozen into the section
   * type, kept because published layouts carry them. The rest are sections the
   * shop looked at and did not want offered. Both end up off the list; only
   * one of them would ever come back.
   */
  notOffered?: string;
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
/**
 * A TICKBOX IN A LIST ROW, read back.
 *
 * `parseListField` below coerces every value in a row to a string, because
 * a row is admin-typed and the rest of the fields genuinely are strings. So
 * a tickbox that was OFF comes back as the string "false" — which is five
 * characters long and therefore truthy. A card explicitly marked NOT wide
 * was rendering wide, and the only way to make it narrow again was to clear
 * the field rather than untick it.
 *
 * Anything a person would read as off is off: an empty value, "false", "0",
 * "no", "off". Everything else is on, so a row saved before this existed
 * with a hand-typed "true" or "yes" still means what it said.
 */
export function rowFlag(value: string | undefined): boolean {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return false;
  return !(["false", "0", "no", "off"].includes(text));
}

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
/**
 * The most banners the turning strip takes.
 *
 * Named once and read twice — by the editor, which stops offering Add, and
 * by the renderer, which caps what it draws. The editor's limit is not a
 * guarantee: a document written before the cap, or by a script, can hold
 * more, and the page is what the customer sees.
 */
export const BANNER_STRIP_MAX = 3;

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
      /*
        THE STATS, DELIVERY FACTS AND PROMISES STRIPS ARE NOT SETTINGS HERE.

        The shop asked for the three of them off the hero editor — not
        because the idea is wrong, but because this is not where they belong,
        and they may go somewhere else later. Their rendering went with them:
        a field removed while its read stays behind leaves stored content on
        the page with nowhere to edit it, which is worse than either.
      */
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
      align: "",
      maxCount: 8,
      picks: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max categories shown", type: "number" },
      {
        /*
          WHICH CATEGORIES, AND IN WHAT ORDER — the shop's choice.

          Empty is the band as it always was: the first few of the shop's
          own categories, whichever they happen to be. Pick one or more and
          the band shows exactly those, in the order they sit here, and the
          count box above stops applying — a shop that picks eight with that
          box reading six would otherwise lose two of its own choices with
          nothing to explain it.

          The picture and the name are OVERRIDES, blank by default: the
          category's own are used unless the shop writes something else.
          They earn their place because a category can be in the catalogue
          with no picture at all — three of this shop's eleven are — and a
          band that draws a picture per tile has nothing to draw for those.
        */
        key: "picks",
        label: "Categories shown",
        type: "list",
        emptyHint: "Nothing picked — the band shows the shop's first few categories.",
        itemFields: [
          {
            key: "categorySlug",
            label: "Category",
            type: "select",
            // Filled from the shop's own catalogue when the editor renders.
            optionsFrom: "categories",
          },
          {
            key: "label",
            label: "Name (leave blank for the category's own)",
            type: "text",
          },
          {
            key: "image",
            label: "Picture (leave blank for the category's own)",
            type: "url",
            isImage: true,
            hint: "600 x 450",
          },
        ],
      },
    ],
  },
  {
    type: "promo-banner",
    notOffered: "the shop asked for it off the picker",
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
      align: "",
      ctaLabel: "",
      ctaHref: routes.store.collections,
      maxCount: 2,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "ctaLabel", label: "Button label", type: "text" },
      { key: "ctaHref", label: "Button link", type: "url" },
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
      align: "",
      maxCount: 4,
      maxTabs: 0,
      source: "",
      tabs: "[]",
      // Blank, like every other rail's. A link nobody wrote is not a link.
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max {products} per tab", type: "number" },
      {
        /*
          HOW MANY OF THE TABS TO DRAW.

          Separate from deleting the tab rows, because the two are different
          things: a shop that wants three tabs on the page and two more
          ready to swap in should not have to retype them. Blank or 0 draws
          every tab there is, which is what this row did before the box
          existed — so nothing already saved changes.
        */
        key: "maxTabs",
        label: "Max tabs shown (0 = all)",
        type: "number",
      },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
      {
        /*
          WHAT THE ROW IS ABOUT, beside what each tab is about.

          Blank is every product in the tab's category, which is what this
          row has always been. Pick a flag and it becomes "the bestsellers
          that are cakes" — the only honest way for a row headed Bestsellers
          to carry category tabs, because otherwise the heading is a claim
          about what sells made over a listing that selects on something
          else entirely.
        */
        key: "source",
        label: "Draw from",
        type: "select",
        options: [
          { label: "Everything in the category", value: "" },
          { label: "Only best sellers", value: "best-sellers" },
          { label: "Only trending", value: "trending" },
          { label: "Only featured", value: "featured" },
        ],
      },
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
    notOffered: "the shop asked for it off the picker",
    label: "Promo cards",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      align: "",
      cards: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      {
        key: "cards",
        label: "Cards",
        type: "list",
        emptyHint: "No cards — this section will not appear on the page.",
        itemFields: [
          {
            key: "image",
            label: "Picture",
            type: "url",
            isImage: true,
            hint: "1200 x 800 — the card crops to fill, so keep the subject centred",
          },
          { key: "title", label: "Heading", type: "text" },
          { key: "subtitle", label: "Line under it", type: "text" },
          { key: "ctaLabel", label: "Button label", type: "text", placeholder: "Shop now" },
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
      align: "",
      shape: "",
      columns: 4,
      tiles: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      {
        /*
          TWO SHAPES OF TILE.

          Plain is what this band has always drawn: a square picture with
          the label under it on the page's own background. A card is what
          the layout the shop held up draws — the picture in a bordered
          box, wider than it is tall, with the label in a tinted bar
          along the foot of it.

          Blank is plain, so every grid already published keeps its shape.
        */
        key: "shape",
        label: "Tile shape",
        type: "select",
        options: [
          { label: "Plain", value: "" },
          { label: "Card", value: "card" },
        ],
      },
      { key: "columns", label: "Tiles per row", type: "number" },
      {
        key: "tiles",
        label: "Tiles",
        type: "list",
        emptyHint: "No tiles — this section will not appear on the page.",
        itemFields: [
          {
            key: "image",
            label: "Picture",
            type: "url",
            isImage: true,
            hint: "Plain: 600 x 600 square · Card: 600 x 450",
          },
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
    notOffered: "the shop asked for it off the picker",
    label: "About what you sell",
    icon: "Text",
    defaultBackground: "cream",
    defaultContent: {
      overline: "",
      title: "",
      align: "",
      blocks: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
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
      align: "",
      ctaLabel: "",
      ctaHref: "",
      posts: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
      {
        key: "posts",
        label: "Articles",
        type: "list",
        emptyHint: "No articles — this section will not appear on the page.",
        itemFields: [
          {
            key: "image",
            label: "Picture",
            type: "url",
            isImage: true,
            hint: "1200 x 675 — 16:9",
          },
          { key: "title", label: "Headline", type: "text" },
          { key: "excerpt", label: "Standfirst", type: "textarea" },
          { key: "meta", label: "Date or byline", type: "text" },
          { key: "href", label: "Link", type: "url" },
        ],
      },
    ],
  },
  {
    /*
      ARTWORK, AND NOTHING THIS FILE WRITES OVER IT.

      The shop makes these banners somewhere else — the heading, the line
      under it and the button are all drawn INTO the picture. So this band
      renders the picture and a link round it, and nothing else. A title
      typed here would sit on top of a title that is already in the image,
      which is why this has no subtitle or button field at all.

      `label` is not drawn either. It is what a screen reader announces for
      the link, because a picture whose words are pixels says nothing to
      somebody who cannot see it.
    */
    type: "banner-grid",
    label: "Banner grid",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      align: "",
      columns: "",
      banners: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      {
        /*
          TWO SHAPES OF BAND, from one section.

          Blank is the collage this band started as: a fifteen-column grid
          where each card is wide or narrow and the row is deliberately
          uneven. It ships blank so every band already published keeps
          the shape it was published with.

          2 and 3 are the even row — same width, same ratio, all the way
          across. It is a different band to look at and the same band to
          fill in, which is why it is a setting here rather than a second
          section type with its own copy of the picture, link and label.
        */
        key: "columns",
        label: "Banners per row",
        type: "select",
        options: [
          { label: "Mixed — wide and narrow", value: "" },
          { label: "2 across", value: "2" },
          { label: "3 across", value: "3" },
        ],
      },
      {
        key: "banners",
        label: "Banners",
        type: "list",
        emptyHint: "No banners — this section will not appear on the page.",
        itemFields: [
          {
            key: "image",
            label: "Banner picture",
            type: "url",
            isImage: true,
            hint: "2 across: 750 x 290 · 3 across: 490 x 290 · Mixed: 1100 x 1000 wide, 800 x 1200 narrow",
          },
          { key: "label", label: "What it says (for screen readers)", type: "text" },
          { key: "href", label: "Link", type: "url" },
          {
            key: "wide",
            label: "Wide — only used when the band is set to Mixed",
            type: "boolean",
          },
        ],
      },
    ],
  },
  {
    /*
      A ROW OF CATEGORIES WITH THE CHEAPEST THING IN EACH.

      THE PRICE IS NOT A FIELD, and that is the point of this entry. It is
      the lowest price among the products actually in the chosen category,
      read at render time. A `Starting from` box an admin could type into
      would be a price this CMS cannot keep true: the shop edits a product,
      the row keeps advertising last month's number, and the customer
      arrives at a page that disagrees with the card that sent them.

      Everything else IS a field, because everything else is a choice: which
      categories, in what order, on which tint, behind which picture.

      Ships empty. There is no sensible default set of categories — they are
      whatever this shop named its own.
    */
    type: "category-price-cards",
    label: "Category cards with prices",
    icon: "LayoutGrid",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      align: "",
      ctaLabel: "",
      ctaHref: "",
      priceLabel: "Starting from",
      items: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
      {
        key: "priceLabel",
        label: "Wording before the price",
        type: "text",
        placeholder: "Starting from",
      },
      {
        key: "items",
        label: "Cards",
        type: "list",
        emptyHint: "No cards — this section will not appear on the page.",
        itemFields: [
          {
            key: "categorySlug",
            label: "Shows",
            type: "select",
            // Filled from the shop's own catalogue when the editor renders.
            optionsFrom: "categories",
          },
          {
            key: "image",
            label: "Picture",
            type: "url",
            isImage: true,
            hint: "800 x 800 — square",
          },
          {
            key: "tone",
            label: "Tint behind the picture",
            type: "select",
            options: [
              { label: "Rose", value: "rose" },
              { label: "Mint", value: "mint" },
              { label: "Sand", value: "sand" },
              { label: "Sky", value: "sky" },
              { label: "Neutral", value: "neutral" },
            ],
          },
          {
            key: "label",
            label: "Name shown (blank uses the category's own)",
            type: "text",
          },
        ],
      },
    ],
  },
  {
    /*
      ONE WIDE BANNER AT A TIME, turning over.

      A strip the shop fills with finished artwork — the words, the offer
      and the button are all drawn into the picture — and when there is more
      than one they cross-fade.

      NO TEXT ON A CARD, and that is what the rule was always about. A title
      on the BANNER would land on top of the words already in the image; a
      heading above the band would not, and the banner grid has had one all
      along. This said it had neither, which read the card's rule onto the
      band and left a shop with a row of artwork it could not name.

      `label` is not drawn. It is what a screen reader announces, because a
      picture whose words are pixels says nothing at all to somebody who
      cannot see it.

      Ships empty. A strip with no artwork in it draws nothing.
    */
    type: "banner-strip",
    label: "Banner strip",
    icon: "Image",
    defaultBackground: "white",
    defaultContent: {
      overline: "",
      title: "",
      align: "",
      ctaLabel: "",
      ctaHref: "",
      // The thinner one, so a band already on the page keeps its shape.
      shape: "strip",
      banners: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      // Blank, like every other band's. A link nobody wrote is not a link.
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
      {
        /*
          A REVERSAL, and worth saying why. This was removed as a choice with
          no good answer behind it — true while there was one band, because
          picking a shape does nothing unless the artwork is exported to
          match. It stopped being true the moment there were two: one strip
          on this page is a thin ribbon and right that way, and the other is
          a 4.6:1 banner. One ratio cannot be both.
        */
        key: "shape",
        label: "Shape",
        type: "select",
        options: [
          { label: "Strip — export 1520 x 120", value: "strip" },
          { label: "Banner — export 1520 x 330", value: "banner" },
        ],
      },
      {
        key: "banners",
        label: "Banners",
        type: "list",
        maxItems: BANNER_STRIP_MAX,
        emptyHint: "No banners — this section will not appear on the page.",
        itemFields: [
          {
            key: "image",
            label: "Banner picture",
            type: "url",
            isImage: true,
            hint: "1520 x 120 for a Strip, 1520 x 330 for a Banner — match the Shape",
          },
          {
            /*
              A SECOND PICTURE, SHAPED FOR A PHONE.

              Measured: the wide strip is 12.6:1, which on a 390px screen is
              28 PIXELS TALL. Nothing written into a banner can be read in
              28px, and no CSS fixes it — the answer is a differently
              composed picture, which is what this is. The hero already
              carries one for the same reason.

              Optional. Without it the phone shows the wide banner WHOLE,
              letterboxed on the band's own tint rather than cropped: a
              banner with its offer drawn into one end would lose the offer,
              and this file has not seen the artwork.
            */
            key: "mobileImage",
            label: "Picture for phones",
            type: "url",
            isImage: true,
            hint: "760 x 200 for a Strip, 760 x 400 for a Banner — optional",
          },
          { key: "label", label: "What it says (for screen readers)", type: "text" },
          { key: "href", label: "Link", type: "url" },
        ],
      },
    ],
  },
  {
    /*
      THE SHOP'S CLOSING TIME FOR TODAY, COUNTING DOWN.

      The shape came from a layout the shop held up: three boxes of digits, a
      line beside them, a way in at the end. Nothing else did — not its
      colours, not its sentence, not its button's words.

      There is exactly ONE number behind this band, Settings → Commerce →
      "Same-day orders close at", and it is the same field
      `isPastSameDayCutoff` refuses an order against. That is the whole
      difference between a deadline and a tactic: something else in this
      system enforces it. There is no box here to type a number into,
      deliberately — one would be a second copy of the setting, free to drift
      from the one checkout honours.

      NO `align`, and it is not an omission. This band has no section heading
      — its words sit INSIDE the strip beside the digits — so there is nothing
      for a heading position to move. Same reason `hero`, `store-locator`,
      `newsletter` and `cta` have no control either.
    */
    type: "same-day-countdown",
    label: "Same-day countdown",
    icon: "Clock",
    /*
      A PANEL TONE, because in this renderer that word does not mean a colour
      — it means a SHAPE. `SectionShell` draws any `panel-*` background as a
      rounded card inset in the page's column, and any other background as a
      flat full-width stripe. The reference is a card, and so is every band
      around this one on this shop's page.

      It shipped as `cream` on the argument that `--band-*` is not written by
      `appearanceCssVariables` and so cannot follow a shop's palette. That is
      true and it was the wrong trade: `--surface-cream` on this shop is a
      hair off white, so the band had no edges at all, and the four bands
      above and below it are already `panel-rose`, `panel-sky` and
      `panel-mint`. A band that cannot be seen is worse than one whose tint
      is fixed — and the tint is not fixed to the shop, only to the four
      choices in the Background dropdown, which is where it belongs.

      `sand` because the other three are each already in use on this page.
    */
    defaultBackground: "panel-sand",
    defaultContent: {
      /*
        BLANK, and here that is load-bearing rather than tidy.

        The band draws nothing until this is written, because three boxes
        reading 06 / 02 / 40 with no sentence beside them is a timer that does
        not say what is closing — the reference's pressure tactic with the
        words taken out. And it cannot be seeded: whatever goes here is a
        promise about this shop's own day, and a bakery, a florist and a gift
        shop close theirs for different reasons.
      */
      headline: "",
      // Blank like every other band's. A link nobody wrote is not a link, and
      // the pill does not draw without both halves.
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      {
        /*
          THE WARNING IS IN THE LABEL, because a `hint` on a text field is
          never rendered: section-editor-panel.tsx passes `hint` only to
          `PhotoField` and to image columns of a list. All twelve hints in
          this file today are on image fields, which is why nobody has
          noticed. "Max shown (up to 8)" already does this.
        */
        key: "headline",
        label: "Line beside the clock — the band stays hidden until you write it",
        type: "text",
      },
      { key: "ctaLabel", label: "Button label", type: "text" },
      { key: "ctaHref", label: "Button link", type: "url" },
    ],
  },
  {
    type: "categories",
    notOffered: "the shop asked for it off the picker",
    label: "Featured Categories",
    icon: "LayoutGrid",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Browse by Occasion",
      title: "Featured Categories",
      align: "",
      maxCount: 6,
      picks: "[]",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max categories shown", type: "number" },
      {
        /*
          WHICH CATEGORIES, AND IN WHAT ORDER — the shop's choice.

          Empty is the band as it always was: the first few of the shop's
          own categories, whichever they happen to be. Pick one or more and
          the band shows exactly those, in the order they sit here, and the
          count box above stops applying — a shop that picks eight with that
          box reading six would otherwise lose two of its own choices with
          nothing to explain it.

          The picture and the name are OVERRIDES, blank by default: the
          category's own are used unless the shop writes something else.
          They earn their place because a category can be in the catalogue
          with no picture at all — three of this shop's eleven are — and a
          band that draws a picture per tile has nothing to draw for those.
        */
        key: "picks",
        label: "Categories shown",
        type: "list",
        emptyHint: "Nothing picked — the band shows the shop's first few categories.",
        itemFields: [
          {
            key: "categorySlug",
            label: "Category",
            type: "select",
            // Filled from the shop's own catalogue when the editor renders.
            optionsFrom: "categories",
          },
          {
            key: "label",
            label: "Name (leave blank for the category's own)",
            type: "text",
          },
          {
            key: "image",
            label: "Picture (leave blank for the category's own)",
            type: "url",
            isImage: true,
            hint: "600 x 450",
          },
        ],
      },
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
      align: "",
      maxCount: 4,
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
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
      align: "",
      // A claim about what everyone is talking about, for a shop with no
      // way to know and nothing behind the sentence.
      maxCount: 4,
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
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
      align: "",
      maxCount: 4,
      ctaLabel: "",
      ctaHref: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      // Same two the other rows carry — blank renders no button.
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
    ],
  },
  {
    /*
      WHAT THIS BROWSER HAS LOOKED AT — the only band on this page that is
      different for every visitor.

      It has no content of its own to write: the products come from the
      slugs this browser stored while somebody was reading, resolved against
      the shop's own records. A visitor who has looked at nothing sees no
      band at all, which is most first visits.

      The title ships filled because a band with no heading whose contents
      change per visitor is unreadable, and `Recently viewed` claims nothing
      and is true of any trade. The way-in link ships blank like every other.
    */
    type: "recently-viewed",
    label: "Recently Viewed",
    icon: "History",
    defaultBackground: "cream",
    defaultContent: {
      overline: "",
      title: "Recently viewed",
      align: "",
      ctaLabel: "",
      ctaHref: "",
      maxCount: 8,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
      /*
        THE CEILING IS IN THE LABEL because it is not this band's to raise:
        a browser only ever keeps eight, so a box reading twelve would
        promise four that can never arrive.
      */
      { key: "maxCount", label: "Max shown (up to 8)", type: "number" },
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
      align: "",
      maxCount: 3,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max offers shown", type: "number" },
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
      align: "",
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
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
    ],
  },
  {
    type: "photo-cakes",
    notOffered: "a trade-specific slug frozen into the section type, kept because published layouts carry it",
    label: "Photo Cakes",
    icon: "Camera",
    defaultBackground: "white",
    defaultContent: {
      overline: "Personalised",
      title: "Photo Cakes",
      align: "",
      // The section is a bakery one and keeps its name. The description was
      // still a claim about taste ("delicious") made in the shop's voice.
      maxCount: 4,
      /*
        BLANK, like every other row. It shipped naming the trade, and the
        rule this file states elsewhere is that a link nobody wrote is not a
        link — so a shop that sells flowers was handed a button that says
        cakes, on a band it had not set up yet.
      */
      ctaLabel: "",
      ctaHref: routes.store.collection("photo-cakes"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
    ],
  },
  {
    type: "eggless",
    notOffered: "a trade-specific slug frozen into the section type, kept because published layouts carry it",
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
      align: "",
      maxCount: 4,
      /*
        BLANK, like every other row. It shipped naming the trade, and the
        rule this file states elsewhere is that a link nobody wrote is not a
        link — so a shop that sells flowers was handed a button that says
        cakes, on a band it had not set up yet.
      */
      ctaLabel: "",
      ctaHref: routes.store.collection("eggless"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
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
      align: "",
      maxCount: 4,
      /*
        BLANK, like every other row. It shipped naming the trade, and the
        rule this file states elsewhere is that a link nobody wrote is not a
        link — so a shop that sells flowers was handed a button that says
        cakes, on a band it had not set up yet.
      */
      ctaLabel: "",
      ctaHref: routes.store.collection("seasonal"),
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (left)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "maxCount", label: "Max {products} shown", type: "number" },
      { key: "ctaLabel", label: "View-all label", type: "text" },
      { key: "ctaHref", label: "View-all link", type: "url" },
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
      align: "",
      layout: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        /*
          TWO SHAPES, and the cards are the one that ships.

          Cards is what this band has always been: four bordered boxes, the
          picture above the words. The strip is the shape the shop held up —
          one tinted panel with the four points laid across it, picture
          beside the words rather than over them, and no border round each.

          It ships blank so the band already published keeps the shape it
          was published with.
        */
        key: "layout",
        label: "Shape",
        type: "select",
        options: [
          { label: "Cards", value: "" },
          { label: "One strip", value: "strip" },
        ],
      },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
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
            /*
              A PICTURE INSTEAD OF THE ICON, when the shop has one.

              The four icons below are what this band has always drawn and
              they stay: a shop with nothing to upload still gets a finished
              row. But the layout this is drawn from uses small illustrations,
              and there is no icon set that will ever match a shop
              illustration — so the picture wins wherever there is one.
            */
            key: "image",
            label: "Picture",
            type: "url",
            isImage: true,
            hint: "144 x 144 — square, on a transparent or white background; it is drawn as a circle",
          },
          /*
            NO PLACEHOLDER. This one said "Premium Ingredients" — food, and
            a claim — and three of the four labels that had to be cleaned off
            this page were typed straight out of a placeholder.
          */
          { key: "title", label: "Title", type: "text" },
          { key: "description", label: "Description", type: "text" },
        ],
      },
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
      align: "",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
    ],
  },
  {
    type: "gallery",
    notOffered: "the shop asked for it off the picker",
    label: "Gallery",
    icon: "Images",
    defaultBackground: "white",
    defaultContent: {
      overline: "Sweet Inspiration",
      title: "Gallery",
      align: "",
      // The pictures are the shop's own; the sentence over them named a
      // trade that may not be.
      /*
        BLANK. This pointed at /store/gallery, and that page is gone — the
        shop's photographs live in this band now. A shop that wants a
        view-all here can give it somewhere to go; until then the button
        does not render, which is what every other rail on this page does.
      */
      ctaLabel: "",
      ctaHref: "",
      // The homepage strip is a taste of the gallery, not the gallery. It used
      // to be a hardcoded `slice(0, 8)`; the photos are the shop's own list now
      // and the same list feeds /store/gallery, so without a cap here a shop
      // that curates forty photographs for its gallery page grows a forty-tile
      // block on its homepage whose own "View Full Gallery" button leads to the
      // very same forty.
      maxCount: 8,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "ctaLabel", label: "Button label", type: "text" },
      { key: "ctaHref", label: "Button link", type: "url" },
      { key: "maxCount", label: "Max photos on the homepage", type: "number" },
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
          {
            key: "image",
            label: "Photo",
            type: "url",
            isImage: true,
            hint: "800 x 800 — square",
          },
          { key: "title", label: "Caption", type: "text" },
          { key: "tag", label: "Tag", type: "text", placeholder: "Wedding" },
        ],
      },
    ],
  },
  {
    type: "instagram",
    notOffered: "the shop asked for it off the picker",
    label: "Instagram Gallery",
    icon: "Camera",
    defaultBackground: "cream",
    defaultContent: {
      overline: "Follow Us",
      title: "On Instagram",
      align: "",
      // No handle or URL seeded on purpose: left unset, the section uses the
      // shop's own Instagram from Settings → Social. Baking the demo account in
      // here meant a shop that had configured its real profile still advertised
      // someone else's across seven links and a "Follow @…" button.
      maxCount: 6,
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      {
        key: "align",
        label: "Title position",
        type: "select",
        options: [
          { label: "Default (center)", value: "" },
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
      { key: "instagramHandle", label: "Instagram handle", type: "text" },
      { key: "instagramUrl", label: "Instagram URL", type: "url" },
      { key: "maxCount", label: "Max posts shown", type: "number" },
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
        itemFields: [
          {
            key: "image",
            label: "Photo",
            type: "url",
            isImage: true,
            hint: "800 x 800 — square",
          },
        ],
      },
    ],
  },
  {
    type: "store-locator",
    notOffered: "the shop asked for it off the picker",
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
      buttonLabel: "Get Directions",
    },
    fields: [
      { key: "overline", label: "Overline", type: "text" },
      { key: "title", label: "Title", type: "text" },
      { key: "buttonLabel", label: "Button label", type: "text" },
    ],
  },
  {
    type: "newsletter",
    notOffered: "the shop asked for it off the picker",
    label: "Newsletter",
    icon: "Mail",
    defaultBackground: "white",
    defaultContent: {
      title: "Stay in the Loop",
      // Promised exclusive offers, launches and seasonal specials — three
      // things no shop agreed to send. The box and its button say what it is.
      buttonLabel: "Subscribe",
      disclaimer: "No spam. Unsubscribe anytime.",
    },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "buttonLabel", label: "Button label", type: "text" },
      { key: "disclaimer", label: "Disclaimer", type: "text" },
    ],
  },
  {
    type: "cta",
    notOffered: "the shop asked for it off the picker",
    label: "Call to Action",
    icon: "Megaphone",
    defaultBackground: "white",
    defaultContent: {
      overline: "Get in Touch",
      // The question named the goods and called them perfect; the line under
      // it promised a team. Neither is this software's to say.
      title: "Ready to order?",
      ctaLabel: "Contact us",
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
      { key: "ctaLabel", label: "Button label", type: "text" },
      { key: "ctaHref", label: "Button link", type: "url" },
      { key: "showPhone", label: "Show phone button", type: "boolean" },
      { key: "phone", label: "Phone number", type: "text" },
    ],
  },
];

/**
 * WHAT A SHOP IS OFFERED IN "Add section" — not the whole registry.
 *
 * Exported so the builder and its guard share ONE definition. Written out in
 * the builder instead, a test can only re-implement the same filter and then
 * passes whatever the builder actually does.
 *
 * The registry itself keeps every entry: `getRegistryEntry` searches all of
 * them, and that is how the builder resolves the fields of a section already
 * on a page. Filter there instead and a published `photo-cakes` row loses its
 * editor.
 */
export const ADDABLE_SECTION_REGISTRY: HomepageSectionRegistryEntry[] =
  HOMEPAGE_SECTION_REGISTRY.filter((entry) => !entry.notOffered);

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
