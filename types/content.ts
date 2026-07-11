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
}

export type CmsPageFormData = Omit<CmsPage, "id" | "createdAt" | "updatedAt">;
