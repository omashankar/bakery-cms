/**
 * One-off: put the same-day countdown band on the homepage.
 *
 * Run:  node --env-file=.env.local scripts/the-homepage-says-when-today-closes.mjs
 *       node --env-file=.env.local scripts/the-homepage-says-when-today-closes.mjs --apply
 *
 * DRY RUN unless --apply is passed. Snapshots the document first.
 *
 * THE BAND ITSELF SHIPPED BLANK, which is the point: its line is a promise
 * about this shop's own day, so the code cannot seed one. The owner chose
 * "Time left to order for today's delivery" and asked for it on the page, and
 * that sentence is the only thing this script writes that is not structural.
 *
 * WHERE IT GOES: straight after the category navigation, before the first
 * product rail. The deadline is only worth stating while somebody is still
 * choosing, and at that position it is below the fold at both 390px and
 * 1440px — which matters, because the band is absent from the server HTML and
 * arrives on mount, so inserting it higher would move the top of the page
 * after hydration.
 *
 * NO BUTTON. `ctaLabel`/`ctaHref` stay empty, so the pill does not draw. A
 * label and a destination are the shop's to choose and neither was asked for;
 * the band reads as a fact about today rather than as a second call to action
 * competing with the rails under it. Both boxes are in the builder.
 *
 * `order` IS WHAT THE PAGE SORTS BY, not the position in this array. Every
 * section is renumbered to its index, or the new band would be filed under an
 * order that already exists and the page would draw them in the old sequence
 * — which is exactly what happened the last time this document was rewritten,
 * and no count of sections, products or links noticed.
 */
import { mkdirSync, writeFileSync } from "node:fs";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** What the band says. The owner's words, chosen from three offered. */
const HEADLINE = "Time left to order for today's delivery";

/** It follows this type — the category navigation — wherever the shop has moved it. */
const AFTER_TYPE = "our-menu";

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
writeFileSync(".data/probe/homepage-before-countdown.json", JSON.stringify(row, null, 2));
console.log("snapshot written to .data/probe/homepage-before-countdown.json");

const published = row.data?.published?.sections ?? [];
const draft = row.data?.draft?.sections ?? [];

/* The shop has reordered this page since it was last read from here. */
if (published.some((s) => s.type === "same-day-countdown")) {
  console.log("REFUSED: the band is already on this page.");
  await mongoose.disconnect();
  process.exit(1);
}

const at = published.findIndex((s) => s.type === AFTER_TYPE);
if (at < 0) {
  console.log(`REFUSED: no "${AFTER_TYPE}" band to sit after. The layout has moved on.`);
  await mongoose.disconnect();
  process.exit(1);
}

const band = {
  instanceId: "same-day-countdown-1",
  type: "same-day-countdown",
  order: at + 1,
  isVisible: true,
  /*
    `cream` is the registry's own default for this band: it maps to
    `--surface-cream`, which follows the shop's Appearance surface colour.
    Not one of the `panel-*` tones — those draw `--band-*`, which no shop
    setting can move.
  */
  background: "cream",
  content: { headline: HEADLINE, ctaLabel: "", ctaHref: "" },
};

const insert = (sections) => {
  const index = sections.findIndex((s) => s.type === AFTER_TYPE);
  const next = index < 0 ? [...sections, band] : [
    ...sections.slice(0, index + 1),
    band,
    ...sections.slice(index + 1),
  ];
  return next.map((section, order) => ({ ...section, order }));
};

const nextPublished = insert(published);
const nextDraft = draft.length === published.length ? insert(draft) : nextPublished;

console.log("\nthe page becomes");
for (const [i, s] of nextPublished.entries()) {
  const mine = s.type === "same-day-countdown" ? "  ← NEW" : "";
  console.log(
    `  ${String(i).padStart(2)}  ${String(s.type).padEnd(22)} ${(s.content?.title ?? s.content?.headline ?? "").slice(0, 44)}${mine}`,
  );
}

console.log(`\n${published.length} bands → ${nextPublished.length}`);
console.log(`the band reads: "${HEADLINE}"`);
console.log(
  "it draws only while today's cutoff is still ahead — after it, the page is one band shorter until midnight.",
);

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
const live = after.data?.published?.sections ?? [];
console.log("published now:", live.length, "· orders:", live.map((s) => s.order).join(", "));
console.log(
  "the band is at index",
  live.findIndex((s) => s.type === "same-day-countdown"),
);

await mongoose.disconnect();
