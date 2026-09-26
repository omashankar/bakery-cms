/**
 * One-off: give the header the rows this shop's catalogue can actually fill.
 *
 * Run:  node --env-file=.env.local scripts/the-header-offers-what-the-shop-has.mjs
 *       node --env-file=.env.local scripts/the-header-offers-what-the-shop-has.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the header document first.
 *
 * WHY NOT THE REFERENCE'S ELEVEN ROWS. The header the shop held up has Cakes,
 * Flowers, Plants, Gifts, Personalized Gifts, Chocolates, Combos, Birthday,
 * Anniversary, Occasions and an Express row, over a catalogue of thousands.
 * This shop has TWENTY-SEVEN published products, and six of those eleven rows
 * would open a page with nothing on it. A header that offers a page the shop
 * cannot fill is worse than a short one.
 *
 * EVERY LABEL HERE IS A NAME THE SHOP ALREADY TYPED. Nothing is invented: each
 * row is one of its own categories or occasions, spelled exactly as the
 * catalogue spells it, and each href is that row's own slug. The script reads
 * them live rather than hard-coding them, so it cannot drift from the
 * catalogue and cannot offer a page that is not there.
 *
 * WHICH ONES, and the rule is the product count, not taste: a row earns its
 * place in the band if enough of the shop's catalogue sits behind it. The
 * threshold is stated below and printed for every candidate, so the owner can
 * see what was included and what was not and change either in the Header
 * screen.
 *
 * COLLECTIONS KEEPS ITS AUTOMATIC MENU and is deliberately left alone. With no
 * authored groups it draws "Shop by Category" and "Shop by Occasion" from the
 * live catalogue, so it grows as the shop does; writing those columns by hand
 * would freeze them on today's seven categories.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** A row earns the band at this many published products behind it. */
const MIN_PRODUCTS = 3;
/** The band holds this many promoted rows before it wraps to a second line. */
const MAX_ROWS = 6;

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

for (let attempt = 0; attempt < 5; attempt += 1) {
  try {
    await mongoose.connect(uri);
    break;
  } catch (error) {
    if (attempt === 4) throw error;
  }
}
const db = mongoose.connection.db;

const header = await db.collection("cmsstores").findOne({ _id: "header" });
if (!header) {
  console.log("no header document — nothing to do");
  await mongoose.disconnect();
  process.exit(1);
}

mkdirSync(".data/probe", { recursive: true });
writeFileSync(".data/probe/header-before-rows.json", JSON.stringify(header, null, 2));
console.log("snapshot written to .data/probe/header-before-rows.json");

const catalog = await db.collection("catalogs").findOne({ key: "singleton" });
const products = await db
  .collection("products")
  .find({ status: "published" }, { projection: { categoryId: 1, categoryIds: 1, occasionIds: 1 } })
  .toArray();

const inCategory = (id) =>
  products.filter((p) => (p.categoryIds ?? []).includes(id) || p.categoryId === id).length;
const inOccasion = (id) => products.filter((p) => (p.occasionIds ?? []).includes(id)).length;

/*
  CANDIDATES, each carrying the count that decides it. Occasions first only so
  that a tie between a category and an occasion is broken the same way twice;
  the sort below is what actually orders them.
*/
const candidates = [
  ...(catalog?.occasions ?? [])
    .filter((o) => o.isActive !== false)
    .map((o) => ({
      kind: "occasion",
      name: o.name,
      href: `/store/occasions/${o.slug}`,
      count: inOccasion(o.id),
    })),
  ...(catalog?.categories ?? [])
    .filter((c) => c.isActive !== false)
    .map((c) => ({
      kind: "category",
      name: c.name,
      href: `/store/collections/${c.slug}`,
      count: inCategory(c.id),
    })),
].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

console.log(`\n${products.length} published products. Candidates, by what is behind them:\n`);
for (const c of candidates) {
  const verdict = c.count >= MIN_PRODUCTS ? "" : `  — under ${MIN_PRODUCTS}, left out`;
  console.log(
    `  ${String(c.count).padStart(3)}  ${String(c.name).padEnd(20)} ${c.kind.padEnd(9)} ${c.href}${verdict}`,
  );
}

const chosen = candidates.filter((c) => c.count >= MIN_PRODUCTS).slice(0, MAX_ROWS);

/* The rows the shop already has, kept exactly as they are. */
const existing = header.data?.nav ?? [];
const existingHrefs = new Set(existing.map((n) => n.href));
const fresh = chosen.filter((c) => !existingHrefs.has(c.href));

if (fresh.length === 0) {
  console.log("\nnothing to add — the header already offers all of these");
  await mongoose.disconnect();
  process.exit(0);
}

/*
  APPENDED AFTER WHAT IS THERE, never replacing it. Home and Collections keep
  their order and their settings; a row the shop switched OFF stays off.
*/
const highest = existing.reduce((max, n) => Math.max(max, Number(n.sortOrder) || 0), 0);
const added = fresh.map((c, i) => ({
  id: `nav-auto-${c.href.split("/").pop()}`,
  label: c.name,
  href: c.href,
  isVisible: true,
  sortOrder: highest + i + 1,
}));

console.log(`\nthe band becomes\n`);
for (const n of [...existing, ...added].sort((a, b) => a.sortOrder - b.sortOrder)) {
  const isNew = added.some((a) => a.id === n.id);
  const state = n.isVisible ? "ON " : "off";
  console.log(`  ${state} ${String(n.label).padEnd(20)} ${String(n.href).padEnd(34)}${isNew ? "← NEW" : ""}`);
}
console.log(
  `\nCollections keeps its automatic menu — it reads the live catalogue, so it grows as the shop does.`,
);
console.log("Every label above is a name already in the catalogue; no wording is written here.");

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db
  .collection("cmsstores")
  .updateOne({ _id: "header" }, { $set: { "data.nav": [...existing, ...added] } });
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("cmsstores").findOne({ _id: "header" });
console.log(
  "visible rows now:",
  (after.data?.nav ?? []).filter((n) => n.isVisible).map((n) => n.label).join(", "),
);

await mongoose.disconnect();
