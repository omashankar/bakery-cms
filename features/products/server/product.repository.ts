import { connectDB } from "@/lib/server/db/mongoose";
import { createMongoStore } from "@/lib/server/db/cms-store";
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

const seededFlag = createMongoStore<{ done: boolean }>({
  key: "products-seeded",
  seed: () => ({ done: false }),
});

/**
 * Fill a BRAND NEW shop with the demo catalogue. Once, ever.
 *
 * This ran on every read and keyed off the count alone, so "empty" meant "not
 * seeded yet" forever: a shop that deleted its last demo cake — or cleared the
 * catalogue to start its own — got 34 published demo products back on the next
 * page load, on sale, with prices and stock. The only way out was to keep at
 * least one product at all times.
 *
 * A flag separates the two meanings. Empty now means empty.
 */
async function seedIfEmpty(): Promise<void> {
  const flag = await seededFlag.read();
  if (flag.done) return;

  const count = await ProductModel.estimatedDocumentCount();
  if (count === 0) {
    try {
      await ProductModel.insertMany(seedProducts().map(toDoc), { ordered: false });
    } catch {
      // A concurrent seed hit duplicate _id keys — harmless, the data is there.
    }
  }

  // The flag means "this shop is past the seeding decision", so it is only set
  // once that is TRUE. Setting it unconditionally would let a seed that failed
  // for a real reason — a validation error, a dropped connection — leave a brand
  // new shop permanently empty, having recorded that it was seeded.
  //
  // A shop that already had products is past the decision by definition, and
  // must not be seeded if it is ever emptied later.
  if ((await ProductModel.estimatedDocumentCount()) > 0) {
    await seededFlag.write({ done: true });
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
 * Insert one product. Fails loudly on a duplicate id or slug.
 *
 * Creating a product used to read the entire collection, prepend to the array
 * and write EVERY document back. Two writes are outside that queue — order
 * placement (`$inc` on stockQuantity) and inventory adjustments (`patchFields`)
 * — so a cake sold while an admin was saving had its stock restored by the
 * save, and the shop oversold with its stock figure never moving.
 */
/**
 * Make sure the slug index really is unique, once per process.
 *
 * Declaring `unique: true` on the schema is not enough for a collection that
 * already carries a plain `slug_1`: Mongoose's autoIndex sees an index with that
 * key and leaves it alone, so every existing shop kept the non-unique one and
 * duplicate slugs stayed reachable. Verified — after adding `unique` to the
 * schema the live collection still reported `unique: undefined`.
 *
 * Best-effort. If the index cannot be built (existing duplicates), the write
 * still goes through and the reason is logged, rather than the shop losing the
 * ability to add products.
 */
let uniqueSlugIndex: Promise<void> | null = null;

function ensureUniqueSlugIndex(): Promise<void> {
  uniqueSlugIndex ??= (async () => {
    try {
      const existing = await ProductModel.collection.indexes();
      const slugIndex = existing.find((index) => index.name === "slug_1");
      if (slugIndex && !slugIndex.unique) {
        await ProductModel.collection.dropIndex("slug_1");
      }
      if (!slugIndex?.unique) {
        await ProductModel.collection.createIndex({ slug: 1 }, { unique: true, name: "slug_1" });
      }
    } catch (error) {
      // Clear the memo so the next write tries again. Caching the failure meant
      // one transient error — a blip while the index built — left the process
      // running without slug uniqueness for its entire lifetime, silently.
      uniqueSlugIndex = null;
      console.error(
        "[products] could not enforce a unique slug index — duplicate slugs are possible",
        error,
      );
    }
  })();
  return uniqueSlugIndex;
}

export async function insertOne(product: Product): Promise<Product> {
  await connectDB();
  await ensureUniqueSlugIndex();
  const doc = await ProductModel.create(toDoc(product));
  return toProduct(doc.toObject() as unknown as Raw);
}

/**
 * Whether an error is Mongo refusing a duplicate slug.
 *
 * The uniqueness check was a JS scan followed by a write, which two requests can
 * both pass — and the slug IS the storefront's product URL, so a collision makes
 * one cake unreachable while the other answers for it. The database enforces it
 * now; this turns that refusal back into the 409 the route already promised.
 */
const DUPLICATE_KEY = 11000;

export function isDuplicateSlugError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    keyPattern?: Record<string, unknown>;
    errorResponse?: { code?: unknown; keyPattern?: Record<string, unknown> };
    message?: unknown;
  };

  const message = typeof candidate.message === "string" ? candidate.message : "";
  const isDuplicate =
    candidate.code === DUPLICATE_KEY ||
    candidate.errorResponse?.code === DUPLICATE_KEY ||
    message.includes("E11000");
  if (!isDuplicate) return false;

  const keys = { ...(candidate.errorResponse?.keyPattern ?? {}), ...(candidate.keyPattern ?? {}) };
  return "slug" in keys || message.includes("slug");
}

/** Replace ONE product's document, leaving every other row untouched. */
export async function replaceOne(id: string, product: Product): Promise<Product | null> {
  await connectDB();
  await ensureUniqueSlugIndex();
  const doc = (await ProductModel.findOneAndReplace({ _id: id }, toDoc(product), {
    returnDocument: "after",
  }).lean()) as unknown as Raw | null;
  return doc ? toProduct(doc) : null;
}

/**
 * Move a product's stock in one atomic step, and report where it moved from.
 *
 * The admin adjustment used to read `stockQuantity`, do the arithmetic in JS and
 * write the ABSOLUTE result. An order placed in that window was erased: the
 * cakes left the shop and the number went back to what the admin had been
 * looking at. `$inc` on the same field, inside a transaction, is exactly what
 * order placement does — so the two writers were racing on the one number a shop
 * cannot afford to get wrong.
 *
 * "set" is absolute BY DEFINITION — the admin is declaring a counted figure — so
 * it is the one type that is allowed to overwrite. The pre-image still comes
 * back from the same operation, so the history row records what was really
 * replaced rather than a value read moments earlier.
 */
export async function applyStockDelta(
  id: string,
  type: "add" | "remove" | "set",
  quantity: number,
): Promise<{ before: number; after: number; product: Product } | null> {
  await connectDB();

  const current = { $ifNull: ["$stockQuantity", 0] };
  const nextQuantity =
    type === "add"
      ? { $add: [current, quantity] }
      : type === "remove"
        ? { $max: [0, { $subtract: [current, quantity] }] }
        : quantity;

  // An aggregation-pipeline update: the new value is computed by the database
  // from the row it is writing, so nothing can slip in between the read and the
  // write. `before` is the document as it was, from the same operation.
  //
  // Through `ProductModel.collection` rather than the model. Mongoose casts an
  // update against the schema, and a pipeline is an ARRAY of stages, not a set
  // of field assignments — it rejected the whole call, which surfaced as a 500
  // on every stock adjustment. The raw driver takes it as written.
  const doc = (await ProductModel.collection.findOneAndUpdate(
    { _id: id as unknown as never },
    [{ $set: { stockQuantity: nextQuantity, unlimitedStock: false } }],
    { returnDocument: "before" },
  )) as unknown as Raw | null;

  if (!doc) return null;

  const product = toProduct(doc);
  const before = product.stockQuantity ?? 0;
  const after =
    type === "add" ? before + quantity : type === "remove" ? Math.max(0, before - quantity) : quantity;

  return { before, after, product };
}

/**
 * Set the derived status, but only while the quantity is still the one it was
 * derived from — otherwise a sale landing in between would be labelled by a
 * status computed for a number that is no longer there.
 */
export async function setStockStatusFor(
  id: string,
  quantity: number,
  stockStatus: Product["stockStatus"],
): Promise<void> {
  await connectDB();
  await ProductModel.updateOne(
    { _id: id, stockQuantity: quantity },
    { $set: { stockStatus, updatedAt: new Date().toISOString() } },
  );
}

export async function deleteOne(id: string): Promise<boolean> {
  await connectDB();
  return (await ProductModel.deleteOne({ _id: id })).deletedCount > 0;
}

/**
 * Set the status of many products at once.
 *
 * Bulk Publish/Archive went through the whole-collection rewrite too, once per
 * selected cake — ten selected rows meant ten full-catalogue writes, each
 * carrying a snapshot taken before the previous one landed.
 */
export async function setStatusMany(ids: string[], status: Product["status"]): Promise<number> {
  await connectDB();
  const res = await ProductModel.updateMany(
    { _id: { $in: ids } },
    { $set: { status, updatedAt: new Date().toISOString() } },
  );
  return res.modifiedCount ?? 0;
}

/**
 * Replace the whole collection to match `products` — upsert each and delete any
 * id no longer present, in one bulk operation (safe: no drop-then-insert gap).
 *
 * Only for a restore-from-backup, which really does mean "make the collection
 * exactly this". Ordinary single-product edits must NOT come through here: it
 * writes every document from a snapshot, so anything changed since the read is
 * silently reverted.
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
