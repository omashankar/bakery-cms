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

export type SectionFieldType =
  | "text"
  | "textarea"
  | "url"
  | "number"
  | "select"
  | "boolean"
  | "slides";

export interface SectionFieldDef {
  key: string;
  label: string;
  type: SectionFieldType;
  placeholder?: string;
  isImage?: boolean;
  options?: { label: string; value: string }[];
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
