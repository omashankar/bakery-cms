/**
 * One-off: repoint two homepage tiles at slugs that still resolve.
 *
 * Run:  node --env-file=.env.local scripts/the-homepage-points-at-slugs-that-exist.mjs
 *       node --env-file=.env.local scripts/the-homepage-points-at-slugs-that-exist.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * The catalogue was rebuilt so that a category says what a thing IS. Seven
 * category slugs went with it, and five are still reachable because something
 * else claims them — birthday, wedding and anniversary resolve to occasions of
 * the same name, and seasonal and premium became collections keeping theirs.
 *
 * Two are not. `classic` held a baby-shower cake beside a butterscotch one with
 * nothing in common, and they moved to the types that describe them;
 * `engagement-cakes` held one cake, now a Theme Cake for the Engagement
 * occasion. The homepage still links to both, so those tiles open empty grids.
 *
 * THE LABEL MOVES WITH THE LINK. A tile reading "Classic" that opens Cream
 * Cakes is a worse answer than one that opens nothing — at least the empty page
 * does not claim to be somewhere.
 *
 * A tile is repointed, never removed: the shop put it on its page, and what
 * belongs there is not this script's decision. What it can decide is that a
 * tile leads somewhere.
 *
 * MATCHED AS AN EXACT PAIR — label and href together — because the layout is
 * stored double-encoded, as JSON inside a JSON string, and a loose replacement
 * over that blob is how a script eats an unrelated field. `classic` also sits
 * inside `classic-white-cascade`, a product this must not touch.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** The exact stored pairs, and what each becomes. */
const REPOINT = [
  {
    was: "classic",
    now: "cream-cakes",
    label: ["Classic", "Cream Cakes"],
    why: "its two products are a Cream Cake and a Theme Cake now",
  },
  {
    was: "engagement-cakes",
    now: "engagement",
    label: ["Engagement Cake", "Engagement"],
    why: "the occasion of that name holds the Ring Ceremony cake",
  },
];

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
writeFileSync(".data/probe/homepage-before-repoint.json", JSON.stringify(row, null, 2));
console.log("snapshot written to .data/probe/homepage-before-repoint.json");

const catalog = await db.collection("catalogs").findOne({ key: "singleton" });
const live = new Set([
  ...(catalog?.categories ?? []).map((c) => c.slug),
  ...(catalog?.occasions ?? []).map((c) => c.slug),
  ...(catalog?.collections ?? []).map((c) => c.slug),
]);

let json = JSON.stringify(row.data);
const before = json;

console.log("");
for (const { was, now, label, why } of REPOINT) {
  if (!live.has(now)) {
    console.log(`REFUSED: ${now} is not a live slug either`);
    await mongoose.disconnect();
    process.exit(1);
  }

  /*
    Escaped and unescaped both, because the same layout is stored one level
    deep in some sections and two in others.
  */
  let pairs = 0;
  let selectors = 0;
  for (const q of [String.raw`\"`, '"']) {
    const pair = `${q}label${q}:${q}${label[0]}${q},${q}href${q}:${q}/store/collections/${was}${q}`;
    const next = `${q}label${q}:${q}${label[1]}${q},${q}href${q}:${q}/store/collections/${now}${q}`;
    const seen = json.split(pair).length - 1;
    if (seen) {
      json = json.split(pair).join(next);
      pairs += seen;
    }

    const selector = `${q}categorySlug${q}:${q}${was}${q}`;
    const nextSelector = `${q}categorySlug${q}:${q}${now}${q}`;
    const seenSelector = json.split(selector).length - 1;
    if (seenSelector) {
      json = json.split(selector).join(nextSelector);
      selectors += seenSelector;
    }
  }

  console.log(`"${label[0]}" → "${label[1]}"   /${was} → /${now}`);
  console.log(`   ${pairs} tile(s), ${selectors} row selector(s)`);
  console.log(`   ${why}`);
}

const stillDead = [
  ...new Set([...json.matchAll(/\/store\/(?:collections|occasions)\/([a-z0-9-]+)/g)].map((m) => m[1])),
].filter((slug) => !live.has(slug));
console.log("\nslugs still pointing nowhere:", stillDead.length ? stillDead.join(", ") : "none");

if (json === before) {
  console.log("\nnothing changed — the stored shape is not what this expected.");
  await mongoose.disconnect();
  process.exit(1);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db
  .collection("cmsstores")
  .updateOne({ _id: "homepage-sections" }, { $set: { data: JSON.parse(json) } });
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

await mongoose.disconnect();
