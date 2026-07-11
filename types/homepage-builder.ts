export type SectionBackground = "white" | "cream";

export type HomepageSectionType =
  | "hero"
  | "promo-banner"
  | "categories"
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

export type SectionFieldType = "text" | "textarea" | "url" | "number" | "select" | "boolean";

export interface SectionFieldDef {
  key: string;
  label: string;
  type: SectionFieldType;
  placeholder?: string;
  isImage?: boolean;
  options?: { label: string; value: string }[];
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
