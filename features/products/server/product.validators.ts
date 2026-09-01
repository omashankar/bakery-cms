import { z } from "zod";

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
 * A shop's own fact about a product. A real schema, not the top-level
 * `.passthrough()` — which would accept `attributes: "hello"` and an entry with
 * no value, both of which reach Mongo as Mixed and then render as nothing or as
 * "[object Object]" on the product page.
 *
 * Bounded because it is free text an admin types and the storefront prints: the
 * caps stop a paste turning one product document into a page nobody can read.
 */
const attributeSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1, "An attribute needs a name").max(60),
  value: z.string().trim().min(1, "An attribute needs a value").max(300),
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
    shortDescription: z.string().optional(),
    price: z.number().min(0, "Price cannot be negative"),
    compareAtPrice: z.number().min(0).optional(),
    images: z.array(z.string()).default([]),
    categoryId: z.string().default(""),
    flavourId: z.string().optional(),
    occasionIds: z.array(z.string()).default([]),
    weights: z.array(weightSchema).default([]),
    status: z.enum(["draft", "published", "archived"]),
    isFeatured: z.boolean(),
    isBestSeller: z.boolean(),
    isTrending: z.boolean(),
    isEggless: z.boolean(),
    isPhotoCake: z.boolean(),
    isSeasonal: z.boolean(),
    shapes: z.array(z.string()).default([]),
    flavourOptions: z.array(z.string()).default([]),
    stockStatus: z.enum(["in_stock", "low_stock", "out_of_stock"]),
    stockQuantity: z.number().min(0),
    unlimitedStock: z.boolean(),
    lowStockThreshold: z.number().min(0).optional(),
    allowsMessage: z.boolean(),
    allowsPhotoUpload: z.boolean(),
    ingredients: z.string().optional(),
    variantGroups: z.array(variantGroupSchema).default([]),
    attributes: z.array(attributeSchema).max(40).default([]),
    rating: z.number().min(0).max(5),
    reviewCount: z.number().min(0),
    seo: seoSchema.default({}),
    barcode: z.string().optional(),
    preparationTimeMinutes: z.number().min(0).optional(),
    shelfLifeDays: z.number().min(0).optional(),
    calories: z.number().min(0).optional(),
    allergens: z.string().optional(),
    careInstructions: z.string().optional(),
  })
  .passthrough();

export type ProductFormInput = z.infer<typeof productFormSchema>;
