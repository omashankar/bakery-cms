/**
 * One-off: give the countdown band on the homepage the tone that makes it a card.
 *
 * Run:  node --env-file=.env.local scripts/the-countdown-band-reads-as-a-card.mjs
 *       node --env-file=.env.local scripts/the-countdown-band-reads-as-a-card.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the document first.
 *
 * `panel-*` is not a colour in this renderer, it is a SHAPE: `SectionShell`
 * draws any background starting with `panel` as a rounded card inset in the
 * page's column, and everything else as a flat full-width stripe. The band was
 * published with `cream`, and `--surface-cream` on this shop is a hair off
 * white — so it had no edges at all and read as three boxes loose on the page.
 * Screenshotted before this was noticed.
 *
 * `sand` because the four bands around it already use rose, sky and mint. The
 * registry's default changed with it, so a shop adding this band tomorrow gets
 * the card without anybody having to know this; this script is only for the
 * instance already published here.
 *
 * ONLY `background` CHANGES. The band's words, its order and its visibility are
 * left exactly as they are.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const TYPE = "same-day-countdown";
const TONE = "panel-sand";

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

const row = await db.collection("cmsstores").findOne({ _id: "homepage-sections" });
if (!row) {
  console.log("no homepage layout — nothing to do");
  await mongoose.disconnect();
  process.exit(0);
}

mkdirSync(".data/probe", { recursive: true });
writeFileSync(".data/probe/homepage-before-band-tone.json", JSON.stringify(row, null, 2));
console.log("snapshot written to .data/probe/homepage-before-band-tone.json");

const published = row.data?.published?.sections ?? [];
const draft = row.data?.draft?.sections ?? [];

const found = published.filter((s) => s.type === TYPE);
if (found.length !== 1) {
  console.log(`REFUSED: expected one ${TYPE} band, found ${found.length}.`);
  await mongoose.disconnect();
  process.exit(1);
}
if (found[0].background === TONE) {
  console.log(`nothing to do — the band is already ${TONE}`);
  await mongoose.disconnect();
  process.exit(0);
}

console.log(`\n  ${TYPE}: background ${JSON.stringify(found[0].background)} → ${JSON.stringify(TONE)}`);
console.log("  nothing else on the section changes.");

const retone = (sections) =>
  sections.map((section) => (section.type === TYPE ? { ...section, background: TONE } : section));

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make this change.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db.collection("cmsstores").updateOne(
  { _id: "homepage-sections" },
  {
    $set: {
      "data.published.sections": retone(published),
      "data.draft.sections": retone(draft),
    },
  },
);
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("cmsstores").findOne({ _id: "homepage-sections" });
const band = (after.data?.published?.sections ?? []).find((s) => s.type === TYPE);
console.log("the band is now:", JSON.stringify({ background: band?.background, order: band?.order }));

await mongoose.disconnect();
