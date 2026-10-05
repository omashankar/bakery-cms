/**
 * One-off: take three dead fields out of the catalog document.
 *
 * Run:  node --env-file=.env.local scripts/the-catalog-drops-what-nothing-reads.mjs
 *       node --env-file=.env.local scripts/the-catalog-drops-what-nothing-reads.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * Three things, none of them read by anything:
 *
 *  - `flavours`. A shop-wide list of flavour names, removed from the code when
 *    a flavour became a word typed on the product (`Product.flavourOptions`).
 *    The storefront's flavour filter reads the products; nothing has read this
 *    list since.
 *  - `weights`. The same story one step earlier: shop-wide sizes with a price
 *    modifier, which every product used to derive its tiers from. Sizes are
 *    typed on the product now, in `ProductWeight`, and a shop-wide list was the
 *    wrong shape for a shop that sells more than one kind of thing.
 *  - `cakeCount`, on every category row. A denormalised count that nothing kept
 *    in step, named for one trade besides. The admin counts the shop's real
 *    published products, and the homepage stopped trusting the stored number
 *    after a seed typed one that was wrong — it advertised "48 cakes" under
 *    Birthday in a shop that held 25 products in total.
 *
 * NOTHING ELSE MOVES. The three live lists are read, counted and written back
 * unchanged apart from the one key being dropped from each category row, and
 * the script refuses to write if any of the three has changed length while it
 * was working.
 *
 * The document is snapshotted to .data/probe/ first, so an unwanted result can
 * be put back by hand.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

await mongoose.connect(uri);
const catalogs = mongoose.connection.db.collection("catalogs");

const doc = await catalogs.findOne({ key: "singleton" });
if (!doc) {
  console.log("no catalog document — nothing to do");
  await mongoose.disconnect();
  process.exit(0);
}

/* The snapshot, before anything is decided. */
mkdirSync(".data/probe", { recursive: true });
const snapshot = `.data/probe/catalog-before-drop.json`;
writeFileSync(snapshot, JSON.stringify(doc, null, 2));
console.log("snapshot written to", snapshot);

const categories = doc.categories ?? [];
const withCount = categories.filter((row) => "cakeCount" in row);

console.log("");
console.log("WOULD DROP");
console.log(`  flavours   ${(doc.flavours ?? []).length} row(s)`);
console.log(`  weights    ${(doc.weights ?? []).length} row(s)`);
console.log(`  cakeCount  on ${withCount.length} of ${categories.length} categories`);
for (const row of withCount.slice(0, 12)) {
  console.log(`             · ${row.name} — stored ${row.cakeCount}`);
}

console.log("");
console.log("WOULD KEEP, untouched");
console.log(`  categories   ${categories.length}`);
console.log(`  occasions    ${(doc.occasions ?? []).length}`);
console.log(`  collections  ${(doc.collections ?? []).length}`);

if (!APPLY) {
  console.log("");
  console.log("DRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

/* Re-read and compare, so a concurrent edit is not overwritten. */
const now = await catalogs.findOne({ key: "singleton" });
const sameShape =
  (now?.categories ?? []).length === categories.length &&
  (now?.occasions ?? []).length === (doc.occasions ?? []).length &&
  (now?.collections ?? []).length === (doc.collections ?? []).length;

if (!sameShape) {
  console.log("REFUSED: the catalog changed while this was running. Run it again.");
  await mongoose.disconnect();
  process.exit(1);
}

const nextCategories = (now.categories ?? []).map((row) => {
  const { cakeCount: _dropped, ...rest } = row;
  return rest;
});

const result = await catalogs.updateOne(
  { key: "singleton" },
  {
    $set: { categories: nextCategories },
    $unset: { flavours: "", weights: "" },
  },
);

console.log("");
console.log("matched", result.matchedCount, "· modified", result.modifiedCount);

const after = await catalogs.findOne({ key: "singleton" });
console.log("flavours now:", "flavours" in after ? "STILL THERE" : "gone");
console.log("weights now: ", "weights" in after ? "STILL THERE" : "gone");
console.log(
  "cakeCount now:",
  (after.categories ?? []).some((row) => "cakeCount" in row) ? "STILL THERE" : "gone",
);
console.log(
  "kept:",
  (after.categories ?? []).length,
  "categories ·",
  (after.occasions ?? []).length,
  "occasions ·",
  (after.collections ?? []).length,
  "collections",
);

await mongoose.disconnect();
