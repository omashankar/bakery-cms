/**
 * One-off: file four products under a second category they already read as.
 *
 * Run:  node --env-file=.env.local scripts/four-products-are-filed-where-they-also-belong.mjs
 *       node --env-file=.env.local scripts/four-products-are-filed-where-they-also-belong.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * Every published product sat in exactly ONE category, so each category page
 * was thin — Chocolate held one product — while `categoryIds` has carried more
 * than one since the day it shipped. These four are the ones whose OWN NAME
 * says they belong somewhere else as well.
 *
 * The evidence is the name and nothing else. Not the occasion tags: an occasion
 * is what a thing is FOR and a category is what it IS, and folding one into the
 * other is the exact thing that was just taken apart.
 *
 * APPENDED, never prepended. `categoryIds[0]` is the primary category — the one
 * on the product's badge and in `categoryId` — and putting a new id at the
 * front would silently move the product's main home. Each product keeps the
 * category it had; it gains a second.
 *
 * The owner approved these four individually, by name.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** slug of the product → slug of the category it should ALSO be filed under. */
const ALSO = [
  ["mango-mousse-paradise", "pastries", 'the name says "Mousse"'],
  ["eggless-chocolate-fudge", "chocolate", 'the name says "Chocolate Fudge"'],
  ["black-forest-supreme", "chocolate", "a Black Forest is a chocolate cake"],
  ["choco-chip-brownie-cake", "chocolate", 'the name says "Choco"'],
];

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

await mongoose.connect(uri);
const db = mongoose.connection.db;

const catalog = await db.collection("catalogs").findOne({});
const categoryBySlug = new Map((catalog?.categories ?? []).map((c) => [c.slug, c]));
const nameById = new Map((catalog?.categories ?? []).map((c) => [c.id, c.name]));

const planned = [];
for (const [productSlug, categorySlug, why] of ALSO) {
  const product = await db.collection("products").findOne({ slug: productSlug });
  const category = categoryBySlug.get(categorySlug);

  if (!product) {
    console.log("SKIP  no product at", productSlug);
    continue;
  }
  if (!category) {
    console.log("SKIP  no category at", categorySlug);
    continue;
  }

  const held = product.categoryIds ?? [];
  if (held.includes(category.id)) {
    console.log("SKIP ", product.name, "is already in", category.name);
    continue;
  }

  planned.push({ product, category, why, next: [...held, category.id] });
}

console.log("");
for (const p of planned) {
  console.log(p.product.name);
  console.log(
    "   now: ",
    (p.product.categoryIds ?? []).map((id) => nameById.get(id) ?? id).join(", ") || "(nothing)",
  );
  console.log("   then:", p.next.map((id) => nameById.get(id) ?? id).join(", "));
  console.log("   why: ", p.why);
}

console.log(`\n${planned.length} product(s) would change. Nothing is removed, and the primary stays first.`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

for (const p of planned) {
  /*
    Guarded on the value this was planned against, so a product edited in the
    admin while this ran is left alone rather than overwritten.
  */
  const result = await db.collection("products").updateOne(
    { _id: p.product._id, categoryIds: p.product.categoryIds ?? [] },
    { $set: { categoryIds: p.next, updatedAt: new Date() } },
  );
  console.log(
    result.modifiedCount ? "done   " : "SKIPPED (it changed while this ran) ",
    p.product.name,
  );
}

console.log("\nAFTERWARDS");
const after = await db
  .collection("products")
  .find({ status: "published" }, { projection: { categoryId: 1, categoryIds: 1 } })
  .toArray();
for (const category of catalog?.categories ?? []) {
  const n = after.filter(
    (row) => (row.categoryIds ?? []).includes(category.id) || row.categoryId === category.id,
  ).length;
  console.log(String(n).padStart(4), category.name);
}

await mongoose.disconnect();
