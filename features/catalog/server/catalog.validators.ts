import { z } from "zod";

/**
 * Zod contracts for each catalog section. The client persists whole section
 * arrays, so each schema validates an array of items. Core fields are strict;
 * timestamps/extra fields pass through.
 */

/**
 * What every row of every list carries.
 *
 * `isActive` and `sortOrder` are OPTIONAL and deliberately not defaulted here.
 * `.passthrough()` has always let an unnamed field survive a write, which is
 * how categories kept their description and image before either was declared —
 * but a `.default()` would WRITE a value onto every row of every list the
 * first time any one of them is saved, turning "this shop has never touched
 * the switch" into "this shop set every row on". The readers decide what
 * absent means; the wire keeps absent absent.
 *
 * Named all the same, rather than left to passthrough, because a typo is then
 * a 400 instead of a field that silently does nothing.
 */
const catalogRow = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Name is required"),
    slug: z.string().trim().min(1, "Slug is required"),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
    /*
      NAMED, not left to `.passthrough()`.

      Passthrough would store it either way, and that is the problem: a typo
      in the key saves with a 200 and the page keeps drawing the row's name,
      which is a bug with no symptom. Named, a typo is a 400 the admin sees.
    */
    headline: z.string().trim().optional(),
  })
  .passthrough();

export const categoriesSchema = z.array(
  catalogRow.extend({
    description: z.string().optional(),
    image: z.string().optional(),
  }),
);

export const occasionsSchema = z.array(
  catalogRow.extend({
    description: z.string().optional(),
    image: z.string().optional(),
  }),
);

/**
 * A collection carries what it is FOR as well as what it is called.
 *
 * `productIds` defaults to `[]` rather than being required, because an owner
 * legitimately creates the group first and fills it second — and a write that
 * 400s on an empty group would make the admin unable to save the row it just
 * asked the owner to name.
 *
 * `type` has one value today and is here so that a rule-driven group is a new
 * value rather than a migration of every reader. Optional, so no stored row
 * has to be rewritten to gain it.
 */
export const collectionsSchema = z.array(
  catalogRow.extend({
    description: z.string().optional(),
    image: z.string().optional(),
    type: z.enum(["manual", "dynamic"]).optional(),
    productIds: z.array(z.string()).default([]),
  }),
);

/**
 * A department holds the categories filed under it.
 *
 * `categoryIds` defaults to `[]` rather than being required, for the reason the
 * collection above gives: an owner names the department first and fills it
 * second, and a write that 400s on an empty one would make the screen unable
 * to save the row it just asked them to name.
 *
 * Ids and not slugs. A slug is what a shop edits when it rewrites a page's
 * address, and this has to survive that.
 */
export const departmentsSchema = z.array(
  catalogRow.extend({
    description: z.string().optional(),
    image: z.string().optional(),
    categoryIds: z.array(z.string()).default([]),
  }),
);

export const catalogSectionSchemas = {
  /*
    FIRST, because it is the level above the rest and this object's key
    order is what the Catalog screen's tabs are built from.
  */
  departments: departmentsSchema,
  categories: categoriesSchema,
  occasions: occasionsSchema,
  collections: collectionsSchema,
} as const;

export type CatalogSection = keyof typeof catalogSectionSchemas;

export const CATALOG_SECTIONS = Object.keys(catalogSectionSchemas) as CatalogSection[];
