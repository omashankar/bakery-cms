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
}
