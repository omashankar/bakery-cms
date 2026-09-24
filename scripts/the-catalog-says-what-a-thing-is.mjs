/**
 * One-off: rebuild the catalog so each of the three lists answers ONE question.
 *
 * Run:  node --env-file=.env.local scripts/the-catalog-says-what-a-thing-is.mjs
 *       node --env-file=.env.local scripts/the-catalog-says-what-a-thing-is.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots both documents first.
 *
 * The three lists had drifted into one another. Four CATEGORIES were occasions
 * wearing category clothes — Birthday Cakes, Wedding Cakes, Anniversary,
 * Engagement Cake — each duplicating an occasion of the same name, at the same
 * address, showing nearly the same grid. Three more answered a question that is
 * not "what is this": Seasonal is a WHEN, Premium is a price, and Classic held
 * a baby-shower cake beside a butterscotch one with nothing in common. The one
 * collection was called Plants and held four cakes.
 *
 * So:
 *
 *   CATEGORIES become TYPES, and only types. Seven of them, every product in at
 *   least one, two products in two.
 *
 *   OCCASIONS keep the axis they already had and gain the two the products were
 *   plainly asking for — a Baby Shower Cake and a Ring Ceremony cake had none.
 *   Corporate goes: nothing carries it, so it is a menu row opening an empty
 *   grid.
 *
 *   COLLECTIONS take the two categories that were never types. Seasonal and
 *   Premium are exactly what a collection is for — a group the shop curates —
 *   and keeping their slugs means every link to them still answers.
 *
 * WHAT STILL RESOLVES AFTERWARDS. /store/collections/<slug> falls back to an
 * occasion when no category or collection claims the slug, so birthday, wedding
 * and anniversary keep working and now show the occasion, which is what those
 * pages were mostly showing anyway. seasonal and premium keep working as
 * collections. Two addresses do change: `classic` and `engagement-cakes`, whose
 * three products move to types that describe them.
 *
 * NOTHING IS DELETED FROM A PRODUCT. Every product keeps its occasions, its
 * photos, its price and its status; only `categoryId`/`categoryIds` are
 * rewritten, and every product ends up in at least one category.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/* ── the shape being built ────────────────────────────────────────────── */

/** name → slug. Every one answers "what IS this thing". */
const TYPES = [
  ["Cream Cakes", "cream-cakes", "The round layered cakes, by flavour."],
  ["Chocolate Cakes", "chocolate", "Everything built on chocolate."],
  ["Eggless Cakes", "eggless", "Baked without egg."],
  ["Photo Cakes", "photo-cakes", "Your own picture, printed and placed."],
  ["Tiered Cakes", "tiered-cakes", "Two tiers and up, for the big days."],
  ["Pastries", "pastries", "Sliced and single-serve."],
  ["Theme Cakes", "theme-cakes", "Shaped and decorated to a theme."],
];

/** product slug → the type slugs it belongs to. First is the primary. */
const FILING = {
  "baby-shower-cake": ["theme-cakes"],
  "birthday-cake": ["cream-cakes"],
  "black-forest-supreme": ["chocolate", "cream-cakes"],
  "blush-rose-wedding": ["tiered-cakes"],
  "butterscotch-crunch": ["cream-cakes"],
  "celebration-portrait-cake": ["photo-cakes"],
  "choco-chip-brownie-cake": ["pastries", "chocolate"],
  "chocolate-truffle-delight": ["chocolate"],
  "classic-white-cascade": ["tiered-cakes"],
  "couple-moments-cake": ["theme-cakes"],
  "eggless-chocolate-fudge": ["eggless", "chocolate"],
  "eggless-fruit-fantasy": ["eggless"],
  "eggless-red-velvet": ["eggless"],
  "eggless-vanilla-dream": ["eggless"],
  "festive-gulab-jamun-cake": ["cream-cakes"],
  "fresh-fruit-fantasy": ["cream-cakes"],
  "kids-photo-surprise": ["photo-cakes"],
  "mango-mousse-paradise": ["pastries"],
  "memory-lane-photo-cake": ["photo-cakes"],
  "pineapple-gateau": ["cream-cakes"],
  "pistachio-rose-cake": ["cream-cakes"],
  "red-velvet-classic": ["cream-cakes"],
  "ring-ceremony-special-cake": ["theme-cakes"],
  "royal-tier-elegance": ["tiered-cakes"],
  "silver-anniversary-cake": ["cream-cakes"],
  "sliver-anniversary-cake": ["cream-cakes"],
  "strawberry-bliss": ["cream-cakes"],
  "tiramisu-elegance": ["pastries"],
  "vanilla-dream-cake": ["cream-cakes"],
  "winter-spice-cake": ["cream-cakes"],
};

/** The occasions to keep or create, and which products carry them. */
const OCCASIONS = [
  ["Birthday", "birthday"],
  ["Wedding", "wedding"],
  ["Anniversary", "anniversary"],
  ["Baby Shower", "baby-shower"],
  ["Engagement", "engagement"],
];

/** Products that gain an occasion they plainly needed. slug → occasion slugs. */
const OCCASION_ADDS = {
  "baby-shower-cake": ["baby-shower"],
  "ring-ceremony-special-cake": ["engagement"],
};

/** Occasions with nothing on them: a menu row that opens an empty grid. */
const DROP_OCCASIONS = ["corporate"];

/** The curated groups, taking over from the two categories that were not types. */
const COLLECTIONS = [
  {
    name: "Seasonal Specials",
    slug: "seasonal",
    description: "What we are baking right now.",
    products: [
      "festive-gulab-jamun-cake",
      "mango-mousse-paradise",
      "strawberry-bliss",
      "winter-spice-cake",
    ],
  },
  {
    name: "Premium Collection",
    slug: "premium",
    description: "Our most elaborate work.",
    products: ["pistachio-rose-cake", "royal-tier-elegance", "chocolate-truffle-delight"],
  },
];

/** The collection that was a test: four cakes under the name Plants. */
const DROP_COLLECTIONS = ["plants"];

/* ── work ─────────────────────────────────────────────────────────────── */

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

await mongoose.connect(uri);
const db = mongoose.connection.db;

const catalog = await db.collection("catalogs").findOne({ key: "singleton" });
const products = await db.collection("products").find({}).toArray();
if (!catalog) throw new Error("no catalog document");

mkdirSync(".data/probe", { recursive: true });
writeFileSync(".data/probe/catalog-before-rebuild.json", JSON.stringify(catalog, null, 2));
writeFileSync(
  ".data/probe/products-before-rebuild.json",
  JSON.stringify(
    products.map((p) => ({ _id: p._id, slug: p.slug, categoryId: p.categoryId, categoryIds: p.categoryIds, occasionIds: p.occasionIds })),
    null,
    2,
  ),
);
console.log("snapshots written to .data/probe/");

const now = new Date().toISOString();
const oldCategories = catalog.categories ?? [];
const oldOccasions = catalog.occasions ?? [];

/* Keep the id of a row whose slug survives, so nothing that points at it breaks. */
const idForSlug = (rows, slug) => rows.find((r) => r.slug === slug)?.id;
const newId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;

const categories = TYPES.map(([name, slug, description], index) => {
  const kept = idForSlug(oldCategories, slug);
  return {
    id: kept ?? newId("cat"),
    name,
    slug,
    description,
    image: oldCategories.find((c) => c.slug === slug)?.image,
    sortOrder: index,
    createdAt: oldCategories.find((c) => c.slug === slug)?.createdAt ?? now,
    updatedAt: now,
  };
});

const occasions = OCCASIONS.map(([name, slug], index) => {
  const previous = oldOccasions.find((o) => o.slug === slug);
  return {
    id: previous?.id ?? newId("occ"),
    name,
    slug,
    sortOrder: index,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
});

const catBySlug = new Map(categories.map((c) => [c.slug, c]));
const occBySlug = new Map(occasions.map((o) => [o.slug, o]));
const productBySlug = new Map(products.map((p) => [p.slug, p]));

const collections = COLLECTIONS.map((group, index) => {
  const previous = (catalog.collections ?? []).find((c) => c.slug === group.slug);
  return {
    id: previous?.id ?? newId("col"),
    name: group.name,
    slug: group.slug,
    description: group.description,
    type: "manual",
    sortOrder: index,
    productIds: group.products
      .map((slug) => productBySlug.get(slug)?._id)
      .filter(Boolean)
      .map(String),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
});

/* ── what each product becomes ────────────────────────────────────────── */

const moves = [];
for (const product of products) {
  const wanted = FILING[product.slug];
  if (!wanted) {
    console.log("UNFILED, left alone:", product.slug);
    continue;
  }
  const ids = wanted.map((slug) => catBySlug.get(slug)?.id).filter(Boolean);
  if (ids.length === 0) continue;

  const addOccasions = (OCCASION_ADDS[product.slug] ?? [])
    .map((slug) => occBySlug.get(slug)?.id)
    .filter(Boolean);
  /* Occasions are KEPT and only added to — the shop tagged those itself. */
  const keptOccasions = (product.occasionIds ?? []).filter((id) =>
    occasions.some((o) => o.id === id),
  );
  const nextOccasions = [...new Set([...keptOccasions, ...addOccasions])];

  moves.push({
    product,
    categoryId: ids[0],
    categoryIds: ids,
    occasionIds: nextOccasions,
    types: wanted,
  });
}

console.log("\nCATEGORIES — what a thing IS");
for (const c of categories) {
  const n = moves.filter((m) => m.categoryIds.includes(c.id) && m.product.status === "published").length;
  console.log(String(n).padStart(4), c.name, `/${c.slug}`, idForSlug(oldCategories, c.slug) ? "(kept)" : "(new)");
}
console.log("  dropped:", oldCategories.filter((c) => !catBySlug.has(c.slug)).map((c) => c.name).join(", "));

console.log("\nOCCASIONS — what it is FOR");
for (const o of occasions) {
  const n = moves.filter((m) => m.occasionIds.includes(o.id) && m.product.status === "published").length;
  console.log(String(n).padStart(4), o.name, `/${o.slug}`, oldOccasions.some((x) => x.slug === o.slug) ? "(kept)" : "(new)");
}
console.log("  dropped:", DROP_OCCASIONS.join(", "));

console.log("\nCOLLECTIONS — groups the shop curates");
for (const c of collections) console.log(String(c.productIds.length).padStart(4), c.name, `/${c.slug}`);
console.log("  dropped:", DROP_COLLECTIONS.join(", "));

console.log("\nPRODUCTS");
for (const m of moves) {
  const before = (m.product.categoryIds ?? [])
    .map((id) => oldCategories.find((c) => c.id === id)?.name ?? "?")
    .join(", ");
  console.log(
    ` ${m.product.slug.padEnd(28)} ${String(before || "—").slice(0, 24).padEnd(26)} → ${m.types.join(", ")}`,
  );
}

const unfiled = moves.filter((m) => m.categoryIds.length === 0);
console.log(`\n${moves.length} product(s) refiled · ${unfiled.length} would end up with no category`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

await db.collection("catalogs").updateOne(
  { key: "singleton" },
  { $set: { categories, occasions, collections } },
);
console.log("\ncatalog rewritten");

let changed = 0;
for (const m of moves) {
  const result = await db.collection("products").updateOne(
    { _id: m.product._id },
    {
      $set: {
        categoryId: m.categoryId,
        categoryIds: m.categoryIds,
        occasionIds: m.occasionIds,
        updatedAt: new Date(),
      },
    },
  );
  changed += result.modifiedCount;
}
console.log(changed, "product(s) updated");

await mongoose.disconnect();
