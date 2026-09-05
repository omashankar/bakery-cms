import { z } from "zod";

/**
 * Zod contracts for each catalog section. The client persists whole section
 * arrays, so each schema validates an array of items. Core fields are strict;
 * timestamps/extra fields pass through.
 */

const taxonomyItem = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Name is required"),
    slug: z.string().trim().min(1, "Slug is required"),
  })
  .passthrough();

export const categoriesSchema = z.array(taxonomyItem);
export const occasionsSchema = z.array(taxonomyItem);


export const catalogSectionSchemas = {
  categories: categoriesSchema,
  occasions: occasionsSchema,
} as const;

export type CatalogSection = keyof typeof catalogSectionSchemas;

export const CATALOG_SECTIONS = Object.keys(catalogSectionSchemas) as CatalogSection[];
