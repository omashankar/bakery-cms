/**
 * One-off: renumber the homepage bands so the page reads in the stored order.
 *
 * Run:  node --env-file=.env.local scripts/the-homepage-order-matches-the-list.mjs
 *       node --env-file=.env.local scripts/the-homepage-order-matches-the-list.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * A section carries its own `order`, and that is what the page sorts by — the
 * position in the stored array is not. Rewriting the array into a new sequence
 * therefore changed nothing a visitor could see: the bands came back in their
 * old order, because each one still carried the number it had when there were
 * twenty-one of them.
 *
 * Caught by looking at the page rather than at the write. The write said
 * "21 bands → 9" and meant it; the nine were simply in the wrong order, and
 * every check that counted sections, products or links passed.
 *
 * So `order` becomes the index. Nothing else on a section is touched.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

await mongoose.connect(uri);
const db = mongoose.connection.db;

const row = await db.collection("cmsstores").findOne({ _id: "homepage-sections" });
if (!row) {
  console.log("no homepage layout — nothing to do");
  await mongoose.disconnect();
  process.exit(0);
}

mkdirSync(".data/probe", { recursive: true });
writeFileSync(".data/probe/homepage-before-renumber.json", JSON.stringify(row, null, 2));
console.log("snapshot written to .data/probe/homepage-before-renumber.json");

const renumber = (sections) => sections.map((section, index) => ({ ...section, order: index }));

const published = row.data?.published?.sections ?? [];
const draft = row.data?.draft?.sections ?? [];

console.log("");
for (const [i, s] of published.entries()) {
  const hidden = s.isVisible === false ? "  ← HIDDEN" : "";
  console.log(
    `  ${String(i).padStart(2)}  order ${String(s.order).padStart(2)} → ${String(i).padStart(2)}   ${String(s.type).padEnd(20)} ${s.content?.title ?? ""}${hidden}`,
  );
}

const hidden = published.filter((s) => s.isVisible === false);
if (hidden.length) {
  console.log(`\n${hidden.length} kept band(s) are switched OFF and will not draw:`);
  for (const s of hidden) console.log("   ", s.type, s.content?.title ?? "");
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db.collection("cmsstores").updateOne(
  { _id: "homepage-sections" },
  {
    $set: {
      "data.published.sections": renumber(published),
      "data.draft.sections": renumber(draft.length === published.length ? draft : published),
    },
  },
);
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("cmsstores").findOne({ _id: "homepage-sections" });
console.log(
  "orders now:",
  (after.data?.published?.sections ?? []).map((s) => s.order).join(", "),
);

await mongoose.disconnect();
