/**
 * One-off: give the countdown band the button the shop asked for.
 *
 * Run:  node --env-file=.env.local scripts/the-countdown-band-gets-a-way-in.mjs
 *       node --env-file=.env.local scripts/the-countdown-band-gets-a-way-in.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the document first.
 *
 * The band shipped with `ctaLabel` and `ctaHref` blank, because a label and a
 * destination are the shop's to choose and the renderer draws no button
 * without both. Asked, the owner picked "Shop now" over "Order now" and over
 * having none; the destination is this shop's own all-products page, which is
 * the only page a general "way in" can honestly mean.
 *
 * ONLY the two CTA fields change. The headline, the order, the tone and the
 * visibility are left exactly as they are.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const TYPE = "same-day-countdown";
/** The owner's word, chosen from three offered. */
const LABEL = "Shop now";
/** This shop's own all-products page — `routes.store.collections`. */
const HREF = "/store/collections";

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
writeFileSync(".data/probe/homepage-before-band-cta.json", JSON.stringify(row, null, 2));
console.log("snapshot written to .data/probe/homepage-before-band-cta.json");

const published = row.data?.published?.sections ?? [];
const draft = row.data?.draft?.sections ?? [];

const found = published.filter((s) => s.type === TYPE);
if (found.length !== 1) {
  console.log(`REFUSED: expected one ${TYPE} band, found ${found.length}.`);
  await mongoose.disconnect();
  process.exit(1);
}

const before = found[0].content ?? {};
console.log("");
console.log(`  ctaLabel ${JSON.stringify(before.ctaLabel ?? "")} → ${JSON.stringify(LABEL)}`);
console.log(`  ctaHref  ${JSON.stringify(before.ctaHref ?? "")} → ${JSON.stringify(HREF)}`);
console.log(`  headline stays ${JSON.stringify(before.headline ?? "")}`);

/*
  SPREAD ONTO THE STORED CONTENT rather than replacing it. Section content is
  a Mixed bag whose keys differ per type, and writing a fresh object here
  would drop anything an admin has since typed into a field this script has
  never heard of.
*/
const withCta = (sections) =>
  sections.map((section) =>
    section.type === TYPE
      ? { ...section, content: { ...(section.content ?? {}), ctaLabel: LABEL, ctaHref: HREF } }
      : section,
  );

if (!APPLY) {
  console.log("\nDRY RUN — nothing was written. Pass --apply to make this change.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await db.collection("cmsstores").updateOne(
  { _id: "homepage-sections" },
  {
    $set: {
      "data.published.sections": withCta(published),
      "data.draft.sections": withCta(draft),
    },
  },
);
console.log("\nmatched", result.matchedCount, "· modified", result.modifiedCount);

const after = await db.collection("cmsstores").findOne({ _id: "homepage-sections" });
const band = (after.data?.published?.sections ?? []).find((s) => s.type === TYPE);
console.log("the band's content is now:", JSON.stringify(band?.content));

await mongoose.disconnect();
