/**
 * One-off: cut the homepage down to the bands that each say something new.
 *
 * Run:  node --env-file=.env.local scripts/the-homepage-stops-saying-things-twice.mjs
 *       node --env-file=.env.local scripts/the-homepage-stops-saying-things-twice.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the document first.
 *
 * Twenty-one bands over twenty-seven products. FOUR of them were walls of
 * category tiles covering the same categories; THREE were curated product rows
 * — Bestsellers, Trending, Featured — drawing on one small pool through flags
 * that overlap; TWO were bestseller rows outright; and one drew nothing at all.
 *
 * Every removal below was checked against the stored layout rather than
 * inferred from the section's name. What that turned up:
 *
 *  - Section 3, not section 2, holds BOTH mislabelled pictures: its "Eggless
 *    Cakes" banner uses the photograph section 2 correctly labels "Birthday
 *    Cakes", and its "Birthday Cakes" banner uses the one section 2 labels
 *    "Pastries". Section 2's eight are all correctly paired. Dropping 3 fixes
 *    the contradiction without anyone rewriting the shop's artwork.
 *  - Section 4's eggless card carries that same birthday-candles photograph.
 *  - Section 6 is section 4 again — same component, same "Starting from", same
 *    "View all" — under a heading that is the builder's own label for the
 *    section type, left sitting in the title box. One of its cards hotlinks
 *    i.pinimg.com, a file the shop does not control and cannot stop breaking.
 *  - Sections 16 and 17 are the first two TABS of section 18: same category,
 *    same collection, same cap. About 1,000px for products already on screen.
 *  - Section 10's two banners both have an empty label and both point at
 *    /store/collections. No heading, no destination of their own.
 *  - Section 8 spends a full band on ONE banner, linking where the Birthday
 *    row above it already leads.
 *
 * WHAT IS NOT TOUCHED. The content inside a surviving band is the shop's own —
 * which banner, which tile, which words. Three headings are set, and each one
 * is either a phrase the section type already ships as its default or a plain
 * label for a band that currently draws a heading row with nothing in it. No
 * claim, offer or price is written here.
 *
 * NOTHING BECOMES UNREACHABLE. `our-menu` reads the live taxonomy rather than a
 * hand-kept list, so it alone stays in step with the catalogue and covers all
 * seven categories — including Cream Cakes, the shop's largest at ten products,
 * which appears in none of the hand-built walls.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** The bands that stay, in the order a visitor should meet them. */
const KEEP = [
  [0, "hero — the shop's own three slides"],
  [15, "Birthday Cakes — 19 of 27 products; what most people came for"],
  [1, "the only category navigation that reads the live catalogue"],
  [5, "Bestsellers, as tabs — 8 per tab against the flat row's 4"],
  [2, "Must Have — the one picture wall whose eight labels all match"],
  [9, "Photo Cakes — the thing this shop does that a supermarket does not"],
  [18, "the three tabs that absorb the Eggless and Seasonal rows"],
  [11, "why us — the trust strip, at the close where it belongs"],
  [13, "recently viewed — nothing to a stranger, the last word to a returner"],
];

/** Headings for bands that draw a heading row and have nothing in it. */
const HEADINGS = {
  1: "Shop by category",
  18: "More to browse",
  11: "Why Choose Us",
};

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
writeFileSync(".data/probe/homepage-before-tidy.json", JSON.stringify(row, null, 2));
console.log("snapshot written to .data/probe/homepage-before-tidy.json");

const published = row.data?.published?.sections ?? [];
const draft = row.data?.draft?.sections ?? [];

if (published.length !== 21) {
  console.log(`REFUSED: expected 21 sections, found ${published.length}. The layout has moved on.`);
  await mongoose.disconnect();
  process.exit(1);
}

const keepIndexes = KEEP.map(([i]) => i);
const dropped = published
  .map((section, i) => ({ section, i }))
  .filter(({ i }) => !keepIndexes.includes(i));

console.log(`\nKEEPING ${KEEP.length}, in this order`);
for (const [i, why] of KEEP) {
  const s = published[i];
  const heading = HEADINGS[i] ?? s.content?.title ?? "";
  console.log(
    `  ${String(i).padStart(2)} ${String(s.type).padEnd(21)} ${(heading || "(no heading)").padEnd(20)}`,
    HEADINGS[i] ? "← heading set" : "",
  );
  console.log(`     ${why}`);
}

console.log(`\nDROPPING ${dropped.length}`);
for (const { section, i } of dropped) {
  console.log(`  ${String(i).padStart(2)} ${String(section.type).padEnd(21)} ${section.content?.title ?? ""}`);
}

/** Rebuild in the new order, setting only the headings named above. */
const rebuild = (sections) =>
  KEEP.map(([i]) => {
    const section = sections[i];
    if (!HEADINGS[i]) return section;
    return { ...section, content: { ...(section.content ?? {}), title: HEADINGS[i] } };
  });

const nextPublished = rebuild(published);
const nextDraft = draft.length === published.length ? rebuild(draft) : nextPublished;

console.log(`\n${published.length} bands → ${nextPublished.length}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make these changes.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db.collection("cmsstores").updateOne(
  { _id: "homepage-sections" },
  {
    $set: {
      "data.published.sections": nextPublished,
      "data.draft.sections": nextDraft,
    },
  },
);
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("cmsstores").findOne({ _id: "homepage-sections" });
console.log(
  "published now:",
  (after.data?.published?.sections ?? []).length,
  "· draft now:",
  (after.data?.draft?.sections ?? []).length,
);

await mongoose.disconnect();
