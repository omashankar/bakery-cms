import { connectDB } from "@/lib/server/db/mongoose";
import { ProductModel, type ProductDoc } from "@/lib/server/db/models/product.model";
import {
  normalizeCommerceFields,
  seedProducts,
} from "@/features/products/lib/products-repository";
import type { Product } from "@/types/product";

/**
 * Product repository — the only place that touches the products collection.
 *
 * Reuses the existing `seedProducts` / `normalizeCommerceFields` so a fresh
 * Mongo collection matches what the app has always shipped. Docs are stored
 * with the app's string id as `_id`; `toProduct` maps it back to `id`.
 */

type Raw = ProductDoc & { __v?: number };

function toDoc(product: Product): ProductDoc {
  const { id, ...rest } = product;
  return { _id: id, ...rest };
}

function toProduct(raw: Raw): Product {
  const { _id, __v, ...rest } = raw;
  void __v;
  return normalizeCommerceFields({ ...rest, id: _id } as Product);
}

async function seedIfEmpty(): Promise<void> {
  const count = await ProductModel.estimatedDocumentCount();
  if (count > 0) return;
  try {
    await ProductModel.insertMany(seedProducts().map(toDoc), { ordered: false });
  } catch {
    // A concurrent seed hit duplicate _id keys — harmless, the data is there.
  }
}

/** All products, newest first, seeding the collection on first use. */
export async function listAll(): Promise<Product[]> {
  await connectDB();
  await seedIfEmpty();
  const docs = (await ProductModel.find().sort({ createdAt: -1 }).lean()) as unknown as Raw[];
  return docs.map(toProduct);
}

export async function findById(id: string): Promise<Product | null> {
  await connectDB();
  const doc = (await ProductModel.findById(id).lean()) as unknown as Raw | null;
  return doc ? toProduct(doc) : null;
}

export async function findBySlug(slug: string): Promise<Product | null> {
  await connectDB();
  const doc = (await ProductModel.findOne({ slug }).lean()) as unknown as Raw | null;
  return doc ? toProduct(doc) : null;
}

export async function slugExists(slug: string, exceptId?: string): Promise<boolean> {
  await connectDB();
  const filter = exceptId ? { slug, _id: { $ne: exceptId } } : { slug };
  return (await ProductModel.exists(filter)) !== null;
}

/**
 * Replace the whole collection to match `products` — upsert each and delete any
 * id no longer present, in one bulk operation (safe: no drop-then-insert gap).
 */
export async function replaceAll(products: Product[]): Promise<void> {
  await connectDB();
  const keepIds = products.map((p) => p.id);
  const ops: Parameters<typeof ProductModel.bulkWrite>[0] = products.map((p) => ({
    replaceOne: { filter: { _id: p.id }, replacement: toDoc(p), upsert: true },
  }));
  ops.push({ deleteMany: { filter: { _id: { $nin: keepIds } } } });
  await ProductModel.bulkWrite(ops);
}

export async function reset(): Promise<void> {
  await connectDB();
  await ProductModel.deleteMany({});
}

/**
 * Targeted field update (e.g. a stock adjustment) — sets only the given fields
 * plus a fresh `updatedAt`, without rewriting the whole document. Returns the
 * updated product, or null if the id does not exist.
 */
/**
 * Write the review aggregate onto a product, addressed by slug.
 *
 * Separate from `patchFields` because reviews only know the slug, and because
 * this must never go through the read-modify-write path: it runs while an admin
 * may be saving that product, and a full-document write would carry a stale
 * snapshot of everything else.
 */
export async function setReviewAggregate(
  slug: string,
  aggregate: { count: number; average: number },
): Promise<void> {
  await connectDB();
  await ProductModel.updateOne(
    { slug },
    { $set: { rating: aggregate.average, reviewCount: aggregate.count } },
  );
}

export async function patchFields(
  id: string,
  fields: Partial<Product>,
): Promise<Product | null> {
  await connectDB();
  const doc = (await ProductModel.findByIdAndUpdate(
    id,
    { $set: { ...fields, updatedAt: new Date().toISOString() } },
    { new: true },
  ).lean()) as unknown as Raw | null;
  return doc ? toProduct(doc) : null;
}
