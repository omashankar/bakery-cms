import { connectDB } from "@/lib/server/db/mongoose";
import { ReviewModel, type ReviewDoc } from "@/lib/server/db/models/review.model";
import type { ProductReview } from "@/types/review";

/** Review repository — the only place that touches the reviews collection. */

type Raw = ReviewDoc & { __v?: number };

function toDoc(review: ProductReview): ReviewDoc {
  const { id, ...rest } = review;
  return { _id: id, ...rest } as ReviewDoc;
}

function toReview(raw: Raw): ProductReview {
  const { _id, __v, ...rest } = raw as Record<string, unknown>;
  void __v;
  return { ...rest, id: String(_id) } as ProductReview;
}

/**
 * Insert a NEW review. Never an upsert.
 *
 * This was `updateOne({_id}, {$set}, {upsert: true})`, and the only caller is the
 * unauthenticated storefront submit endpoint whose schema accepted the id from
 * the request body. So an anonymous POST carrying an existing id rewrote that
 * review in place — author, rating and body — and because `submitReview` forces
 * `status: "pending"`, rewriting an approved review also took it off the
 * storefront. Seeded ids are `review-seed-<product-slug>-<n>`, so nothing had to
 * be guessed. Verified against a running shop before this change.
 *
 * `insertOne` turns an id collision into a duplicate-key error instead of a
 * silent overwrite, which is what lets the service tell the two cases apart.
 */
export async function create(review: ProductReview): Promise<ProductReview> {
  await connectDB();
  await ReviewModel.create(toDoc(review));
  return review;
}

/**
 * Newest-first, capped.
 *
 * getReviewOverview() counts moderation states and averages the rating over
 * whatever this returns. The pending/rejected counts are recency-biased and so
 * stay right, but the ALL-TIME average rating silently drifts once a shop has
 * more than this many reviews. Move that average to a server aggregation before
 * anyone relies on it.
 */
export async function listAll(limit = 2000): Promise<ProductReview[]> {
  await connectDB();
  const docs = (await ReviewModel.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as unknown as Raw[];
  return docs.map(toReview);
}

/**
 * The storefront's review list. PUBLIC — anyone can call it for any slug, so it
 * returns only what a product page actually renders.
 *
 * It used to return the whole document, which put `authorEmail` in an
 * unauthenticated response: `GET /api/reviews?productSlug=<anything>` was a
 * harvestable list of the shop's customers' email addresses, and the slugs are
 * public. `reportReason` — an internal moderation note about the reviewer —
 * came out with it.
 *
 * Listing the fields instead of excluding the bad ones is deliberate: a field
 * added to the model later is private by default rather than published by
 * accident.
 */
const PUBLIC_REVIEW_FIELDS = {
  productSlug: 1,
  cakeName: 1,
  authorName: 1,
  rating: 1,
  title: 1,
  body: 1,
  status: 1,
  isFeatured: 1,
  adminReply: 1,
  repliedAt: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

export async function listApprovedByProduct(productSlug: string): Promise<ProductReview[]> {
  await connectDB();
  const docs = (await ReviewModel.find({ productSlug, status: "approved" })
    .select(PUBLIC_REVIEW_FIELDS)
    .sort({ isFeatured: -1, createdAt: -1 })
    .lean()) as unknown as Raw[];
  return docs.map(toReview);
}

export async function findById(id: string): Promise<ProductReview | null> {
  await connectDB();
  const doc = (await ReviewModel.findById(id).lean()) as unknown as Raw | null;
  return doc ? toReview(doc) : null;
}

export async function patch(
  id: string,
  fields: Partial<ProductReview>,
): Promise<ProductReview | null> {
  await connectDB();
  const { id: _drop, ...rest } = fields;
  void _drop;
  const doc = (await ReviewModel.findByIdAndUpdate(
    id,
    { $set: { ...rest, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toReview(doc) : null;
}

export async function deleteMany(ids: string[]): Promise<number> {
  await connectDB();
  const res = await ReviewModel.deleteMany({ _id: { $in: ids } });
  return res.deletedCount ?? 0;
}

export async function count(): Promise<number> {
  await connectDB();
  return ReviewModel.estimatedDocumentCount();
}

export async function seedIfEmpty(seed: ProductReview[]): Promise<void> {
  await connectDB();
  if ((await count()) > 0 || seed.length === 0) return;
  await ReviewModel.insertMany(seed.map(toDoc), { ordered: false }).catch(() => undefined);
}
