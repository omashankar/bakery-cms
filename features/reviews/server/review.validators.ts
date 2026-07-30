import { z } from "zod";

const reviewStatus = z.enum(["pending", "approved", "rejected", "reported"]);

/**
 * Public submit. The storefront builds the record and dual-writes it, so
 * id/timestamps are accepted; status/isFeatured are forced server-side (a public
 * submission can never self-approve or self-feature).
 */
export const submitReviewSchema = z.object({
  id: z.string().min(1).optional(),
  cakeId: z.string().optional(),
  productSlug: z.string().min(1),
  cakeName: z.string().optional(),
  authorName: z.string().min(1),
  authorEmail: z.string().email().optional(),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(1),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** Admin moderation patch. */
/**
 * Every field the admin edit form can change.
 *
 * The identity fields below (author, product, order) were missing, and zod is
 * non-strict, so it stripped them silently: an admin fixing a misspelled
 * reviewer name or re-pointing a review at the right product got a 200 and a
 * "Review updated" toast for a change that only ever existed in their browser,
 * and which the next hydration reverted. If the form offers it, the endpoint
 * takes it.
 */
export const updateReviewSchema = z
  .object({
    status: reviewStatus.optional(),
    isFeatured: z.boolean().optional(),
    adminReply: z.string().optional(),
    repliedAt: z.string().optional(),
    reportReason: z.string().optional(),
    title: z.string().optional(),
    body: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
    authorName: z.string().min(1).optional(),
    authorEmail: z.string().optional(),
    cakeId: z.string().min(1).optional(),
    productSlug: z.string().min(1).optional(),
    cakeName: z.string().min(1).optional(),
    orderNumber: z.string().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "No fields to update" });

export const deleteReviewsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type UpdateReviewInput = z.infer<typeof updateReviewSchema>;
