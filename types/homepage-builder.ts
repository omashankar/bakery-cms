/**
 * The ground a band is drawn on.
 *
 * "white" and "cream" are full-width: the colour runs to both edges of the
 * window and the band's content sits in the page's column.
 *
 * "panel" is not a ground at all, it is a CARD. The band stays white and the
 * content is drawn inside a rounded tinted box inset from the edges — the
 * shape the reference layout gives the rows it wants to lift out of the page
 * (its bestseller rails, its trust strip). A stripe says 'a different part of
 * the page'; a card says 'this row, in particular'.
 */
export type SectionBackground =
  | "white"
  | "cream"
  /**
   * A card, in one of four tints.
   *
   * `panel` is the neutral one. The four named tones exist so a page of
   * twenty rows reads as a sequence rather than as one colour repeated —
   * which is what the layout being followed does with its rails.
   */
  | "panel"
  | "panel-rose"
  | "panel-mint"
  | "panel-sand"
  | "panel-sky";

export type HomepageSectionType =
  | "hero"
  | "our-menu"
  | "promo-banner"
  | "categories"
  | "store-locator"
  | "featured-cakes"
  | "trending"
  | "best-sellers"
  | "offers"

  /**
   * A product row named after one of the shop's OWN categories.
   *
   * The three below it are bakery category slugs frozen into this union. They
   * stay for layouts already published; this is the one a shop reaches for.
   */
  /**
   * A band of the shop's OWN promo cards — image, words, its own button.
   *
   * `promo-banner` draws from the shared hero-banner pool, so two promo
   * bands on one page cannot differ and none of them can carry a card's own
   * subtext or its own link. This is the section's own content, which is
   * what the reference's "Must Have" collage, its Personalised band, its
   * Him/Her split and its city banner all are.
   */
  /**
   * One heading, several tabs, one grid.
   *
   * Three product rows down a long page are three scrolls apart. Tabbed,
   * they are one band and a click — which is why the reference uses this
   * shape more than once on the same page.
   */
  | "tabbed-rail"
  | "promo-collage"
  /**
   * A grid of labelled, linked picture tiles.
   *
   * The reference's "Gift Categories" (sixteen tiles) and "International
   * Gifts Delivery" (six country tiles) are the same band with different
   * rows. Not `categories`, which is driven by the catalogue and can only
   * point at a category page.
   */
  | "tile-grid"
  | "banner-grid"
  | "category-price-cards"
  | "banner-strip"
  | "category-rail"
  | "photo-cakes"
  | "eggless"
  | "seasonal"
  | "why-us"
  | "testimonials"
  | "gallery"
  | "instagram"
  | "faq"
  | "newsletter"
  /**
   * The block of prose at the foot of a shop's homepage.
   *
   * Every storefront of this kind carries one, and it is the shop's own
   * writing about what it sells — not a band this CMS can fill in.
   */
  | "seo-prose"
  /** A row of the shop's own articles, linked out. */
  | "blog-cards"
  | "cta";

/**
 * Which half of the picture the words sit in.
 *
 * "left" is the fallback: nothing migrates a hero that predates the key.
 */
export type HeroCopySide = "left" | "right";

export type SectionFieldType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "select"
  | "boolean"
  | "slides"
  | "list";

export interface SectionFieldDef {
  key: string;
  label: string;
  type: SectionFieldType;
  placeholder?: string;
  isImage?: boolean;
  options?: { label: string; value: string }[];
  /**
   * Fill `options` from the shop's live data instead of writing them here.
   *
   * This registry is plain data with no way to reach the catalogue — which
   * is why every category row in it is a hardcoded bakery slug. A field that
   * names a category cannot have its choices written in advance, because the
   * whole point is that the shop invented them. The builder resolves this
   * when it renders the editor.
   */
  optionsFrom?: "categories";
  /**
   * For `type: "list"` — the columns of one row.
   *
   * A list is stored as a JSON string, like `slides`, because a section's
   * content values are primitives: `contentIsUsable` refuses anything that is
   * not a string, number or boolean with a 400.
   */
  itemFields?: SectionFieldDef[];
  /** For `type: "list"` — shown in place of the rows when there are none. */
  emptyHint?: string;
  /**
   * For `type: "list"` — the most rows this field accepts.
   *
   * The editor stops offering Add at the cap and says why. It is NOT a
   * guarantee: a row already stored, or one written by a script, is still
   * in the document, so whatever renders the list has to cap it too.
   */
  maxItems?: number;
  /**
   * For an image field — the size to export at, e.g. "1520 x 120".
   *
   * Shown under the label and left there. A shop that uploads a portrait
   * photograph into a 12:1 strip gets a band of its own background either
   * side, and nothing on the screen had told it what the box wanted.
   */
  hint?: string;
}

/**
 * One hero carousel slide. Stored as a JSON string under the hero section's
 * `content.slides` key (content values are primitives, so the array is encoded).
 */
export interface HeroSlideContent {
  badge?: string;
  headline: string;
  subtext?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  imageUrl?: string;
  /**
   * WHAT THE PICTURE SAYS, for someone who cannot see it.
   *
   * A banner slide is very often a designed graphic with the words drawn
   * INTO it — a headline, a line under it and a button, all pixels. Nothing
   * in the DOM carries any of that, so a screen reader got whatever the
   * image fell back to, and a shop's actual offer was invisible to the
   * people who most need it read out.
   *
   * Blank is fine and common: a slide whose words are real text beside the
   * picture has a decorative picture, and an alt repeating the headline
   * makes a reader say the same sentence twice.
   */
  imageAlt?: string;
  /**
   * A SECOND PICTURE, SHAPED FOR A PHONE.
   *
   * A banner is a wide graphic — roughly 3:1 — and a phone is not wide. Crop
   * one to a phone's box and the sides go: on a banner with its words drawn
   * into the right half, the words are what goes. Fit it instead and a 390px
   * screen gets a 130px-tall strip with 8px type in it.
   *
   * Neither is fixable in CSS, because the answer is a differently composed
   * picture. This is that picture. Absent is the ordinary case and changes
   * nothing — see HeroBannerSlideView for what the phone does without one.
   */
  mobileImageUrl?: string;
}

export interface HomepageSectionInstance {
  instanceId: string;
  type: HomepageSectionType;
  order: number;
  isVisible: boolean;
  background: SectionBackground;
  content: Record<string, string | number | boolean>;
}

export interface HomepageBuilderSnapshot {
  sections: HomepageSectionInstance[];
  updatedAt: string;
  scheduledPublishAt?: string;
}

export interface HomepageBuilderState {
  draft: HomepageBuilderSnapshot;
  published: HomepageBuilderSnapshot;
  /**
   * Bumped by every write, so a save can say which state it was composed
   * against.
   *
   * The builder is replace-all: it PUTs the whole section array. With nothing to
   * compare against, a tab left open at 09:00 and saved at 09:15 silently
   * replaced everything done in between — and Publish pushed that stale copy to
   * the live storefront. Absent on documents written before this existed, which
   * reads as version 0.
   */
  version?: number;
}
