import type { SectionBackground, SectionFieldDef } from "@/types/homepage-builder";

export type WeddingSectionType =
  | "wedding-hero"
  | "wedding-why-us"
  | "wedding-offers"
  | "wedding-collections"
  | "wedding-gallery"
  | "wedding-testimonials"
  | "wedding-inquiry"
  | "wedding-faq"
  | "wedding-cta";

export interface WeddingSectionInstance {
  instanceId: string;
  type: WeddingSectionType;
  order: number;
  isVisible: boolean;
  background: SectionBackground;
  content: Record<string, string | number | boolean>;
}

export interface WeddingBuilderSnapshot {
  sections: WeddingSectionInstance[];
  updatedAt: string;
  scheduledPublishAt?: string;
}

export interface WeddingBuilderState {
  draft: WeddingBuilderSnapshot;
  published: WeddingBuilderSnapshot;
}

export interface WeddingSectionRegistryEntry {
  type: WeddingSectionType;
  label: string;
  icon: string;
  defaultBackground: SectionBackground;
  defaultContent: Record<string, string | number | boolean>;
  fields: SectionFieldDef[];
}
