import { z } from "zod";

import { MAX_PRODUCT_PHOTOS } from "@/features/products/lib/product-limits";

/**
 * Server-side validation for product writes (ProductFormData). Core commerce
 * fields are strict; deeply-nested rich shapes (weights, variantGroups, seo)
 * are kept lenient with `.passthrough()` so the admin form's full payload is
 * accepted without brittle over-specification.
 */

const weightSchema = z
  .object({
    label: z.string(),
    price: z.number().min(0),
    serves: z.string().optional(),
  })
  .passthrough();

const seoSchema = z
  .object({
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    metaKeywords: z.array(z.string()).optional(),
    ogImage: z.string().optional(),
    noIndex: z.boolean().optional(),
    noFollow: z.boolean().optional(),
  })
  .passthrough();

const variantGroupSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    // Inert — see the note on ProductVariantGroup.required. Optional so a group
    // that arrives without it is not a 400 on a field nothing reads.
    required: z.boolean().optional(),
    options: z.array(z.any()),
  })
  .passthrough();

/**
 * One labelled list in the product description. A real schema, not the
 * top-level `.passthrough()` — which would accept `descriptionBlocks: "hello"`
 * and an entry with no body, both of which reach Mongo as Mixed and then render
 * as nothing or as "[object Object]" on the product page.
 *
 * The HEADING may be empty, deliberately: two of the six reference pages list
 * their facts with no label over them. The BODY may not — a heading with
 * nothing under it is the empty section this project keeps deleting.
 *
 * Bounded because it is free text an admin types and the storefront prints: the
 * caps stop a paste turning one product document into a page nobody can read.
 */
const descriptionBlockSchema = z.object({
  id: z.string().trim().min(1),
  heading: z.string().trim().max(80).default(""),
  body: z.string().trim().min(1, "A block needs something under its heading").max(4000),
});

export const productFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Slug may contain only letters, numbers and hyphens"),
    description: z.string().default(""),
    price: z.number().min(0, "Price cannot be negative"),
    compareAtPrice: z.number().min(0).optional(),
    /**
     * Capped, and capped HERE as well as in the form.
     *
     * The form is where an admin meets the limit; this is where it holds. A
     * cap only in the browser is a suggestion — the same shape as the
     * delivery slots, the minimum order and the shop-wide lead time, each of
     * which was configured in the admin, checked in the browser, and honoured
     * by nothing when a request arrived without one.
     */
    images: z
      .array(z.string())
      .max(
        MAX_PRODUCT_PHOTOS,
        `A product can have at most ${MAX_PRODUCT_PHOTOS} photos. Remove one and save again.`,
      )
      .default([]),
    categoryId: z.string().default(""),
    occasionIds: z.array(z.string()).default([]),
    weights: z.array(weightSchema).default([]),
    weightLabel: z.string().optional(),
    status: z.enum(["draft", "published", "archived"]),
    isFeatured: z.boolean(),
    isBestSeller: z.boolean(),
    isTrending: z.boolean(),
    shapes: z.array(z.string()).default([]),
    flavourOptions: z.array(z.string()).default([]),
    stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock"]),
    stockQuantity: z.number().min(0),
    unlimitedStock: z.boolean(),
    lowStockThreshold: z.number().min(0).optional(),
    allowsMessage: z.boolean(),
    allowsPhotoUpload: z.boolean(),
    /**
     * Optional, unlike the three booleans around it.
     *
     * Those are required, so every product literal in the app and in the
     * suite already carries them. A required seventh would 400 every import,
     * seed and API client written before today for a field whose absence has
     * a perfectly good meaning.
     */
    photoFrameShape: z
      .enum(["circle", "square", "heart"])
      .optional(),
    variantGroups: z.array(variantGroupSchema).default([]),
    descriptionBlocks: z.array(descriptionBlockSchema).max(20).default([]),
    rating: z.number().min(0).max(5),
    reviewCount: z.number().min(0),
    seo: seoSchema.default({}),

  })
  .passthrough();

export type ProductFormInput = z.infer<typeof productFormSchema>;
