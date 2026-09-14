export type SectionBackground = "white" | "cream";

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
  | "wedding"
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
  /**
   * How the hero is drawn.
   *
   * Exported so the registry's dropdown and the renderer's branch read the
   * SAME two words. They are compared as strings across a Mongo round trip,
   * and a third spelling in either place is a hero that silently falls back.
   *
   * "split" is the fallback everywhere, and must be: every hero section
   * stored before this existed has no layout key at all, and nothing
   * migrates them.
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
  | "cta";

export type HeroLayout = "split" | "banner";

/**
 * Which half of a banner the words sit in.
 *
 * Only the banner reads it. The split hero is a two-column grid whose sides
 * are the grid's, and "left" is the fallback everywhere for the same reason
 * "split" is: nothing migrates a hero that predates the key.
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
