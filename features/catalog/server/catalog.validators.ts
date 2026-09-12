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

/**
 * A collection carries what it is FOR as well as what it is called.
 *
 * `productIds` defaults to `[]` rather than being required, because an owner
 * legitimately creates the group first and fills it second — and a write that
 * 400s on an empty group would make the admin unable to save the row it just
 * asked the owner to name.
 */
export const collectionsSchema = z.array(
  taxonomyItem.extend({
    description: z.string().optional(),
    image: z.string().optional(),
    productIds: z.array(z.string()).default([]),
  }),
);

export const catalogSectionSchemas = {
  categories: categoriesSchema,
  occasions: occasionsSchema,
  collections: collectionsSchema,
} as const;

export type CatalogSection = keyof typeof catalogSectionSchemas;

export const CATALOG_SECTIONS = Object.keys(catalogSectionSchemas) as CatalogSection[];
