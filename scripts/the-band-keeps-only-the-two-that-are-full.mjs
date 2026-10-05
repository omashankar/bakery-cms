/**
 * One-off: cut the band back to the two rows the owner chose.
 *
 * Run:  node --env-file=.env.local scripts/the-band-keeps-only-the-two-that-are-full.mjs
 *       node --env-file=.env.local scripts/the-band-keeps-only-the-two-that-are-full.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the header document first.
 *
 * `the-header-offers-what-the-shop-has.mjs` added six rows at a threshold of
 * three products. Shown the counts, the owner picked the tighter answer
 * instead: Birthday and Cream Cakes only. Chocolate Cakes, Eggless Cakes,
 * Wedding and Anniversary have four, four, four and three products behind
 * them, and a top-level row that opens on three cakes reads as a shop that has
 * run out rather than as a section. All four are still one tap away inside the
 * Collections menu, which lists every category and every occasion.
 *
 * REMOVED BY ID, NOT BY A QUERY. The four ids are named below and nothing else
 * is touched — not Home, not Collections, not the two rows the shop has
 * switched off, and not the two being kept. A filter on "auto-added" or on
 * "occasions" would have caught rows this script has no business deleting the
 * day somebody adds one by hand with a similar href.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** Exactly the four this removes. Anything not on this list survives. */
const DROP = [
  "nav-auto-chocolate",
  "nav-auto-eggless",
  "nav-auto-wedding",
  "nav-auto-anniversary",
];

/** Named so the script can refuse if the shop has since removed them. */
const KEEP = ["nav-auto-birthday", "nav-auto-cream-cakes"];

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
writeFileSync(".data/probe/header-before-trim.json", JSON.stringify(header, null, 2));
console.log("snapshot written to .data/probe/header-before-trim.json");

const nav = header.data?.nav ?? [];
const byId = new Map(nav.map((n) => [n.id, n]));

const missingKeep = KEEP.filter((id) => !byId.has(id));
if (missingKeep.length) {
  console.log(`REFUSED: the rows this keeps are gone — ${missingKeep.join(", ")}`);
  await mongoose.disconnect();
  process.exit(1);
}

const present = DROP.filter((id) => byId.has(id));
if (present.length === 0) {
  console.log("nothing to do — none of those four rows is in the header");
  await mongoose.disconnect();
  process.exit(0);
}

console.log("\nremoving");
for (const id of present) console.log(`  ${String(byId.get(id).label).padEnd(18)} ${byId.get(id).href}`);

const next = nav.filter((n) => !DROP.includes(n.id));

console.log("\nthe band becomes");
for (const n of [...next].sort((a, b) => a.sortOrder - b.sortOrder)) {
  console.log(`  ${n.isVisible ? "ON " : "off"} ${String(n.label).padEnd(18)} ${n.href}`);
}
console.log(
  "\nthe four removed are still inside the Collections menu, which lists every category and occasion.",
);

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db
  .collection("cmsstores")
  .updateOne({ _id: "header" }, { $set: { "data.nav": next } });
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("cmsstores").findOne({ _id: "header" });
console.log(
  "visible rows now:",
  (after.data?.nav ?? []).filter((n) => n.isVisible).map((n) => n.label).join(", "),
);

await mongoose.disconnect();
