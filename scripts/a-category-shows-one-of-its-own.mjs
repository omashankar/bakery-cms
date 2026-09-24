/**
 * One-off: give the four pictureless categories a photograph of their own.
 *
 * Run:  node --env-file=.env.local scripts/a-category-shows-one-of-its-own.mjs
 *       node --env-file=.env.local scripts/a-category-shows-one-of-its-own.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the catalog first.
 *
 * A CATEGORY WITH NO PICTURE IS NOT OFFERED AT ALL. `selectHomepageCategories`
 * drops it — deliberately, because the band draws a picture per tile and a
 * pictureless one is a hole. Rebuilding the catalogue into seven types left
 * four of them without one, so the homepage's only category navigation was
 * showing three of seven, and Cream Cakes — the shop's largest at ten products
 * — was not among them.
 *
 * THE PICTURE COMES FROM THE CATEGORY'S OWN PRODUCTS. Not a stock photograph
 * chosen here: this shop's own first published product in that category, the
 * same image a customer sees on its card. Nothing is invented and nothing is
 * downloaded — the URL already exists in the catalogue.
 *
 * A category the shop has already given a picture is left alone.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

await mongoose.connect(uri);
const db = mongoose.connection.db;

const catalog = await db.collection("catalogs").findOne({ key: "singleton" });
const products = await db
  .collection("products")
  .find({ status: "published" }, { projection: { name: 1, slug: 1, images: 1, categoryId: 1, categoryIds: 1 } })
  .toArray();

mkdirSync(".data/probe", { recursive: true });
writeFileSync(".data/probe/catalog-before-pictures.json", JSON.stringify(catalog, null, 2));
console.log("snapshot written to .data/probe/catalog-before-pictures.json");

const inCategory = (product, id) =>
  (product.categoryIds ?? []).includes(id) || product.categoryId === id;

const planned = [];
console.log("");
for (const category of catalog?.categories ?? []) {
  if ((category.image ?? "").trim()) {
    console.log(`  keeps its own   ${category.name}`);
    continue;
  }

  /*
    The PRIMARY member first. A product filed here as its second category is a
    weaker answer to "what does this category look like" than one filed here
    first, and on this catalogue every category has at least one of the latter.
  */
  const primary = products.find((p) => p.categoryId === category.id && (p.images ?? [])[0]);
  const any = products.find((p) => inCategory(p, category.id) && (p.images ?? [])[0]);
  const source = primary ?? any;

  if (!source) {
    console.log(`  NO PHOTO ANYWHERE  ${category.name} — no published product here carries one`);
    continue;
  }

  planned.push({ category, image: source.images[0], from: source.name });
  console.log(
    `  takes one       ${category.name.padEnd(18)} ← ${source.name}`,
  );
}

console.log(`\n${planned.length} category picture(s) would be set. Nothing else on the row changes.`);

if (planned.length === 0) {
  await mongoose.disconnect();
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

const byId = new Map(planned.map((p) => [p.category.id, p.image]));
const next = (catalog.categories ?? []).map((category) =>
  byId.has(category.id)
    ? { ...category, image: byId.get(category.id), updatedAt: new Date().toISOString() }
    : category,
);

const result = await db
  .collection("catalogs")
  .updateOne({ key: "singleton" }, { $set: { categories: next } });
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("catalogs").findOne({ key: "singleton" });
const without = (after.categories ?? []).filter((c) => !(c.image ?? "").trim());
console.log(
  "categories still without a picture:",
  without.length ? without.map((c) => c.name).join(", ") : "none",
);

await mongoose.disconnect();
