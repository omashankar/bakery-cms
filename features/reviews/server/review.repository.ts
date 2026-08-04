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

export async function create(review: ProductReview): Promise<ProductReview> {
  await connectDB();
  await ReviewModel.updateOne({ _id: review.id }, { $set: toDoc(review) }, { upsert: true });
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

export async function listApprovedByProduct(productSlug: string): Promise<ProductReview[]> {
  await connectDB();
  const docs = (await ReviewModel.find({ productSlug, status: "approved" })
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
