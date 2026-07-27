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

export async function create(inquiry: Inquiry): Promise<Inquiry> {
  await connectDB();
  // Upsert on the app id so a re-sent create (best-effort dual-write) is idempotent.
  await InquiryModel.updateOne(
    { _id: inquiry.id },
    { $set: toDoc(inquiry) },
    { upsert: true },
  );
  return inquiry;
}

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
