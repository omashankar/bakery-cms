import { connectDB } from "@/lib/server/db/mongoose";
import { NewsletterModel, type NewsletterDoc } from "@/lib/server/db/models/newsletter.model";
import type { NewsletterSubscriber } from "@/types/inquiry";

/** Newsletter repository — the only place that touches the subscribers collection. */

type Raw = NewsletterDoc & { __v?: number };

function toDoc(sub: NewsletterSubscriber): NewsletterDoc {
  const { id, ...rest } = sub;
  return { _id: id, ...rest, email: sub.email.toLowerCase().trim() } as NewsletterDoc;
}

function toSub(raw: Raw): NewsletterSubscriber {
  const { _id, __v, ...rest } = raw as Record<string, unknown>;
  void __v;
  return { ...rest, id: String(_id) } as NewsletterSubscriber;
}

/** Subscribe (public). Dedupes by email — an existing subscriber is reactivated. */
export async function subscribe(sub: NewsletterSubscriber): Promise<NewsletterSubscriber> {
  await connectDB();
  const email = sub.email.toLowerCase().trim();
  const now = new Date().toISOString();
  const doc = (await NewsletterModel.findOneAndUpdate(
    { email },
    {
      $set: { isActive: true, updatedAt: now },
      $setOnInsert: {
        _id: sub.id,
        email,
        source: sub.source ?? "Website",
        createdAt: sub.createdAt ?? now,
      },
    },
    { upsert: true, new: true },
  ).lean()) as unknown as Raw;
  return toSub(doc);
}

/**
 * Newest-first, capped.
 *
 * The subscriber list is browsed, not totalled, so the cap truncates a page
 * rather than corrupting a figure. A "total subscribers" stat added on top of
 * this would be wrong past the cap and would look perfectly plausible.
 */
export async function listAll(limit = 5000): Promise<NewsletterSubscriber[]> {
  await connectDB();
  const docs = (await NewsletterModel.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as unknown as Raw[];
  return docs.map(toSub);
}

export async function findById(id: string): Promise<NewsletterSubscriber | null> {
  await connectDB();
  const doc = (await NewsletterModel.findById(id).lean()) as unknown as Raw | null;
  return doc ? toSub(doc) : null;
}

export async function patch(
  id: string,
  fields: Partial<NewsletterSubscriber>,
): Promise<NewsletterSubscriber | null> {
  await connectDB();
  const { id: _drop, ...rest } = fields;
  void _drop;
  const doc = (await NewsletterModel.findByIdAndUpdate(
    id,
    { $set: { ...rest, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toSub(doc) : null;
}

export async function deleteMany(ids: string[]): Promise<number> {
  await connectDB();
  const res = await NewsletterModel.deleteMany({ _id: { $in: ids } });
  return res.deletedCount ?? 0;
}

export async function count(): Promise<number> {
  await connectDB();
  return NewsletterModel.estimatedDocumentCount();
}

/** One-time seed of demo subscribers. Skips if any already exist. */
export async function seedIfEmpty(seed: NewsletterSubscriber[]): Promise<void> {
  await connectDB();
  if ((await count()) > 0) return;
  await NewsletterModel.insertMany(seed.map(toDoc), { ordered: false }).catch(() => undefined);
}
