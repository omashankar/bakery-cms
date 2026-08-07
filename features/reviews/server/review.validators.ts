import { z } from "zod";

const reviewStatus = z.enum(["pending", "approved", "rejected", "reported"]);

/**
 * Public submit. Anonymous — so it decides nothing about its own identity.
 *
 * `id`, `createdAt` and `updatedAt` used to be accepted here because the
 * storefront built the record locally and dual-wrote it. Three separate powers
 * came with that, and this endpoint has no session to justify any of them:
 *
 *   - `id` reached a repository that upserted on it, so an anonymous POST
 *     carrying an existing id REWROTE that review — and since status is forced
 *     back to "pending", rewriting an approved one also removed it from the
 *     storefront. Seeded ids are `review-seed-<product-slug>-<n>`.
 *   - `createdAt` is the sort key for both the storefront list and the
 *     moderation queue, so a submitter could pin themselves to the top of each.
 *
 * All three are now minted server-side. The response carries the created review,
 * which is where the caller gets the authoritative id.
 *
 * status/isFeatured were already forced server-side — a public submission can
 * never self-approve or self-feature.
 */
export const submitReviewSchema = z.object({
  cakeId: z.string().optional(),
  productSlug: z.string().min(1),
  cakeName: z.string().optional(),
  authorName: z.string().min(1),
  authorEmail: z.string().email().optional(),
  rating: z.number().min(1).max(5),
  title: z.string().optional(),
  body: z.string().min(1),
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
