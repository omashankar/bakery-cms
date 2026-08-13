import type { BaseEntity, EntityStatus, SeoFields } from "./common";

export interface Testimonial extends BaseEntity {
  name: string;
  role: string;
  content: string;
  avatar: string;
  rating: number;
  status: EntityStatus;
  isFeatured: boolean;
  sortOrder: number;
}

export type FaqCategory = "general" | "orders" | "wedding" | "delivery";

export interface FaqItem extends BaseEntity {
  question: string;
  answer: string;
  category: FaqCategory;
  status: EntityStatus;
  sortOrder: number;
}

export type TestimonialFormData = Omit<
  Testimonial,
  "id" | "createdAt" | "updatedAt"
>;

export type FaqFormData = Omit<FaqItem, "id" | "createdAt" | "updatedAt">;

export type CmsPageTemplate = "standard" | "about";

export type CmsPageBlockType = "paragraph" | "heading";

export interface CmsPageBlock {
  id: string;
  type: CmsPageBlockType;
  content: string;
}

/** One cell of the About page's stats band. */
export interface CmsPageAboutStat {
  id: string;
  value?: string;
  label?: string;
}

/** One card in the About page's "why choose us" grid. */
export interface CmsPageAboutHighlight {
  id: string;
  /** A key of the template's icon set; anything unknown falls back to Award. */
  icon?: string;
  title?: string;
  description?: string;
}

/**
 * The About template's own copy, per page.
 *
 * These were constants in `cms-page-view.tsx` and `landing-data.ts`: "Since
 * 1965", "60+ Years of baking", "1M+ Happy customers", "500+ Cake varieties",
 * "4.9★", "Six decades of craft…", and four cards claiming six decades of
 * expertise and same-day delivery across 500+ cities. They are the DEMO
 * brand's history, and this CMS runs many bakeries — so every shop that
 * published an About page published someone else's past as its own, with no
 * field anywhere to change or remove it.
 *
 * Every member is optional and every empty value hides its own section, so a
 * page that has never been filled in carries no claim at all.
 */
export interface CmsPageAboutContent {
  /** The plate over the hero image — was "Since 1965". */
  badgeTitle?: string;
  /** Its second line — was "Baking joy for generations". */
  badgeSubtitle?: string;
  /** The badge above the prose — was "Our Story". */
  storyLabel?: string;
  stats?: CmsPageAboutStat[];
  /** Was "Why Choose Us". */
  highlightsTitle?: string;
  /** Was "Six decades of craft, quality, and care…". */
  highlightsDescription?: string;
  highlights?: CmsPageAboutHighlight[];
  ctaTitle?: string;
  ctaDescription?: string;
  ctaPrimaryLabel?: string;
  ctaSecondaryLabel?: string;
}

export interface CmsPage extends BaseEntity {
  title: string;
  slug: string;
  description: string;
  template: CmsPageTemplate;
  blocks: CmsPageBlock[];
  heroImage?: string;
  status: EntityStatus;
  isSystem: boolean;
  sortOrder: number;
  scheduledPublishAt?: string;
  seo?: SeoFields;
  about?: CmsPageAboutContent;
}

export type CmsPageFormData = Omit<CmsPage, "id" | "createdAt" | "updatedAt">;
