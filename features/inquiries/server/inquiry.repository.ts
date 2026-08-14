import { connectDB } from "@/lib/server/db/mongoose";
import { InquiryModel, type InquiryDoc } from "@/lib/server/db/models/inquiry.model";
import type { Inquiry } from "@/types/inquiry";

/** Inquiry repository — the only place that touches the inquiries collection. */

type Raw = InquiryDoc & { __v?: number };

function toDoc(inquiry: Inquiry): InquiryDoc {
  const { id, ...rest } = inquiry;
  return { _id: id, ...rest } as InquiryDoc;
}

function toInquiry(raw: Raw): Inquiry {
  const { _id, __v, ...rest } = raw as Record<string, unknown>;
  void __v;
  return { ...rest, id: String(_id) } as Inquiry;
}

/**
 * Insert a NEW enquiry. Never an upsert.
 *
 * This was `updateOne({_id}, {$set}, {upsert: true})` — for idempotency on a
 * re-sent dual-write — and the only caller is the unauthenticated contact form,
 * whose schema took the id from the request body. The stored ids are `inq-1`,
 * `inq-7`, `inq-11`, so an anonymous POST carrying a guessed one rewrote that
 * enquiry in place. Proved against a running shop before this change.
 *
 * The id is minted server-side now, so a re-sent create makes a second row
 * rather than destroying a first — the failure mode of a duplicate enquiry is a
 * duplicate the shop can see and delete, which is strictly better than a real
 * one silently replaced.
 */
export async function create(inquiry: Inquiry): Promise<Inquiry> {
  await connectDB();
  await InquiryModel.create(toDoc(inquiry));
  return inquiry;
}

/**
 * Newest-first, capped.
 *
 * The cap is safe for the numbers the admin actually reads: the sidebar badge
 * and dashboard card count NEW inquiries, and a new inquiry is by definition
 * among the newest, so it is inside the window. An ALL-TIME total derived from
 * this would be wrong past the cap — do not add one without a server count().
 */
export async function listAll(limit = 1000): Promise<Inquiry[]> {
  await connectDB();
  const docs = (await InquiryModel.find()
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean()) as unknown as Raw[];
  return docs.map(toInquiry);
}

export async function findById(id: string): Promise<Inquiry | null> {
  await connectDB();
  const doc = (await InquiryModel.findById(id).lean()) as unknown as Raw | null;
  return doc ? toInquiry(doc) : null;
}

export async function patch(id: string, fields: Partial<Inquiry>): Promise<Inquiry | null> {
  await connectDB();
  const { id: _drop, ...rest } = fields;
  void _drop;
  const doc = (await InquiryModel.findByIdAndUpdate(
    id,
    { $set: { ...rest, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toInquiry(doc) : null;
}

export async function deleteMany(ids: string[]): Promise<number> {
  await connectDB();
  const res = await InquiryModel.deleteMany({ _id: { $in: ids } });
  return res.deletedCount ?? 0;
}

export async function count(): Promise<number> {
  await connectDB();
  return InquiryModel.estimatedDocumentCount();
}

/** One-time seed of demo inquiries. Skips ids that already exist. */
export async function seedIfEmpty(seed: Inquiry[]): Promise<void> {
  await connectDB();
  if ((await count()) > 0) return;
  await InquiryModel.insertMany(seed.map(toDoc), { ordered: false }).catch(() => undefined);
}
