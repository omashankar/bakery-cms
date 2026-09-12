/**
 * One-off data repair: every product written before a product could be filed
 * in more than one place.
 *
 * Run:  node --env-file=.env.local scripts/file-every-product-under-the-category-it-already-has.mjs
 *       node --env-file=.env.local scripts/file-every-product-under-the-category-it-already-has.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints every document it would touch.
 *
 * Why this exists
 * ---------------
 * `categoryIds` holds every category a product is filed under, primary first.
 * Products written before it existed carry `categoryId` and nothing else.
 *
 * Nothing is BROKEN by that: `normalizeCommerceFields` derives the array from
 * `categoryId` on every read, so the storefront, the counts and the admin all
 * behave. This is about the one thing a read-time default cannot reach — a
 * query. A `$match` or an index on `categoryIds` sees only what the documents
 * actually hold, and today half of them hold nothing. Writing the field the
 * code already assumes is what lets the database answer for itself later,
 * instead of every caller loading the whole catalogue first.
 *
 * It is deliberately the smallest possible write:
 *
 *   - Only documents where `categoryIds` is MISSING or EMPTY. A product the
 *     shop has already filed in two places is never touched, so this cannot
 *     undo a real choice by re-deriving the array from the primary.
 *   - The value is `[categoryId]` — the category the product already has. This
 *     adds no membership and removes none. Every category page shows exactly
 *     what it showed before.
 *   - A product with no `categoryId` at all is REPORTED and skipped, never
 *     given `[]` or guessed at. An unfiled product is a thing for a person to
 *     look at.
 *
 * Safe to run twice: the second run finds nothing left to do.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

await mongoose.connect(uri);
const products = mongoose.connection.db.collection("products");

/**
 * Missing, or present but empty.
 *
 * `$size: 0` alone misses the documents that have no field, and
 * `$exists: false` alone misses the ones a half-finished write left as `[]`.
 * Both are "filed nowhere", and both are what this repairs.
 */
const UNFILED = {
  $or: [{ categoryIds: { $exists: false } }, { categoryIds: { $size: 0 } }],
};

const total = await products.countDocuments({});
const rows = await products
  .find(UNFILED, { projection: { name: 1, slug: 1, categoryId: 1, categoryIds: 1 } })
  .toArray();

console.log(`${total} products, ${rows.length} of them filed nowhere\n`);

let planned = 0;
const unfilable = [];

for (const row of rows) {
  const primary = typeof row.categoryId === "string" ? row.categoryId.trim() : "";

  if (!primary) {
    // No category at all. Not this script's call to invent one.
    unfilable.push(row);
    console.log(`SKIP  ${row.name ?? row.slug} — has no categoryId either`);
    continue;
  }

  console.log(`PLAN  ${row.name ?? row.slug} — categoryIds: [${primary}]`);
  planned += 1;

  if (APPLY) {
    // Guarded by the same condition that selected it, so a product filed in
    // two places by someone between the read above and this write is left
    // alone rather than flattened back to its primary.
    await products.updateOne(
      { _id: row._id, ...UNFILED },
      { $set: { categoryIds: [primary] } },
    );
  }
}

console.log(
  `\n${planned} product${planned === 1 ? "" : "s"} ${APPLY ? "UPDATED" : "would be updated"}.`,
);
if (unfilable.length) {
  console.log(
    `${unfilable.length} left alone because they carry no category at all — ` +
      "give them one in the admin, then re-run.",
  );
}
if (!APPLY && planned > 0) console.log("Re-run with --apply to write.");

if (APPLY) {
  // Read back, so the report is what the database holds rather than what was sent.
  const left = await products.countDocuments(UNFILED);
  const mismatched = await products.countDocuments({
    categoryIds: { $exists: true, $ne: [] },
    $expr: { $ne: [{ $arrayElemAt: ["$categoryIds", 0] }, "$categoryId"] },
  });

  console.log(`\nAfter: ${left} still filed nowhere (expected ${unfilable.length}).`);
  console.log(
    `       ${mismatched} whose first categoryIds entry is not their categoryId ` +
      "(expected 0 — the primary is always first).",
  );
}

await mongoose.disconnect();
