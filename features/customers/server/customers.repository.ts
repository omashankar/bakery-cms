import { connectDB } from "@/lib/server/db/mongoose";
import { CustomerMetaModel } from "@/lib/server/db/models/customer-meta.model";
import type { CustomerAdminMeta } from "@/types/customer";

/** Customers repository — admin-managed metadata, keyed by email. */

function toMeta(doc: Record<string, unknown> | null, email: string): CustomerAdminMeta & { blocked: boolean } {
  return {
    email: (doc?.email as string) ?? email,
    tags: (doc?.tags as string[]) ?? [],
    notes: (doc?.notes as string) ?? "",
    marketingOptIn: (doc?.marketingOptIn as boolean) ?? true,
    blocked: (doc?.blocked as boolean) ?? false,
    updatedAt: (doc?.updatedAt as string) ?? new Date().toISOString(),
  };
}

export async function getMeta(email: string) {
  await connectDB();
  const key = email.toLowerCase().trim();
  const doc = (await CustomerMetaModel.findOne({ email: key }).lean()) as Record<string, unknown> | null;
  return toMeta(doc, key);
}

export async function listMeta() {
  await connectDB();
  const docs = (await CustomerMetaModel.find().lean()) as Record<string, unknown>[];
  const map = new Map<string, CustomerAdminMeta & { blocked: boolean }>();
  for (const d of docs) map.set(d.email as string, toMeta(d, d.email as string));
  return map;
}

export async function upsertMeta(email: string, fields: Partial<CustomerAdminMeta> & { blocked?: boolean }) {
  await connectDB();
  const key = email.toLowerCase().trim();
  const doc = (await CustomerMetaModel.findOneAndUpdate(
    { email: key },
    { $set: { ...fields, email: key } },
    { new: true, upsert: true },
  ).lean()) as Record<string, unknown> | null;
  return toMeta(doc, key);
}
