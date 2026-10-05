/**
 * A PAGE OF ROWS, NOT ONE COLOUR REPEATED.
 *
 *   node --env-file=.env.local scripts/give-each-band-its-own-tone.mjs
 *   …add --apply to write.
 *
 * The `panel` background gained four tones. This puts them on the bands that
 * are drawn as cards, so a long page reads as a sequence.
 *
 * SETTINGS ONLY. No wording is written by this script. In particular it does
 * NOT put a heading on the tabbed rails: the layout being followed heads that
 * band "Bestsellers", and ours shows whatever is in a category tab — birthday
 * cakes, wedding cakes, photo cakes — which is not the same claim. A heading
 * that says a row is the shop's best sellers when it is a category listing is
 * the shop telling its customers something its own data does not say. The
 * boxes are in the builder, blank, for the owner to fill.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** Which card gets which tint. Nothing else about these bands changes. */
const TONES = {
  "tabbed-rail-top": "panel-rose",
  "trending-5": "panel-sand",
  "why-us-12": "panel-sand",
  "tabbed-rail-lower": "panel-mint",
  "best-sellers-6": "panel-sky",
};

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

const store = await stores.findOne({ _id: "homepage-sections" });
const version = store?.data?.version;
if (typeof version !== "number") {
  console.log("no version on the homepage store — refusing to write");
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`version: ${version}`);

function rebuild(which) {
  const sections = store.data?.[which]?.sections ?? [];
  const ledger = [];
  const out = sections.map((s) => {
    const tone = TONES[s.instanceId];
    if (!tone || s.background === tone) return s;
    ledger.push(`${(s.type ?? "").padEnd(14)} ${s.instanceId.padEnd(22)} ${s.background} -> ${tone}`);
    return { ...s, background: tone };
  });
  return { sections: out, ledger };
}

const draft = rebuild("draft");
const published = rebuild("published");

for (const line of published.ledger) console.log("  " + line);

const missing = Object.keys(TONES).filter(
  (id) => !(store.data?.published?.sections ?? []).some((s) => s.instanceId === id),
);
if (missing.length) {
  console.log(`\nno such section: ${missing.join(", ")} — refusing to write`);
  await mongoose.disconnect();
  process.exit(1);
}

if (!published.ledger.length) {
  console.log("\nnothing to change.");
  await mongoose.disconnect();
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  {
    $set: {
      "data.draft.sections": draft.sections,
      "data.published.sections": published.sections,
      "data.version": version + 1,
      "data.updatedAt": new Date(),
    },
  },
);

if (result.matchedCount !== 1) {
  console.log("VERSION MOVED — nothing written.");
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
console.log(`\nWROTE. version ${version} -> ${after?.data?.version}`);
const tones = (after?.data?.published?.sections ?? [])
  .filter((s) => String(s.background).startsWith("panel"))
  .map((s) => `${s.instanceId}:${s.background}`);
console.log("readback: " + tones.join("  "));

await mongoose.disconnect();
