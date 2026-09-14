/**
 * One-off: the category band under the hero, the way the shop asked for it.
 *
 * Run:  node --env-file=.env.local scripts/let-the-category-tiles-sit-under-the-hero.mjs
 *       node --env-file=.env.local scripts/let-the-category-tiles-sit-under-the-hero.mjs --apply
 *
 *   our-menu-1.overline    "Explore"           -> ""
 *   our-menu-1.title       "Shop by category"  -> ""
 *   our-menu-1.background  "cream"             -> "white"
 *
 * The tiles say what they are — each one is a category name under its own
 * picture — so a heading over them repeats the band rather than introducing it,
 * and the reference layout the shop is working from has none. White because the
 * band directly under a full-bleed banner reads as a second band when it is
 * tinted, and the tiles carry their own tint already.
 *
 * The heading is BLANKED, not deleted: the fields are still there and still
 * editable, so typing a line back in the builder brings it straight back. And
 * SectionHeader now renders nothing at all when all three are blank, so this
 * costs no space — before that fix it would have left an empty 36px heading and
 * a 40px margin, which is the gap that made this band look wrong in the first
 * place.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const ROW = "our-menu-1";

const EDITS = [
  { key: "overline", expect: "Explore", to: "" },
  { key: "title", expect: "Shop by category", to: "" },
];

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===\n");

const doc = await stores.findOne({ _id: "homepage-sections" });
const version = doc?.data?.version;
if (typeof version !== "number") {
  console.log(`FAIL: data.version is ${JSON.stringify(version)}`);
  process.exit(1);
}
console.log(`data.version = ${version} (the write is pinned to it)\n`);

const next = JSON.parse(JSON.stringify(doc.data));
let changed = 0;
let skipped = 0;

for (const which of ["draft", "published"]) {
  const row = next[which].sections.find((s) => s.instanceId === ROW);
  if (!row) {
    console.log(`MISS  ${which}/${ROW} (row not found)`);
    skipped += 1;
    continue;
  }

  for (const edit of EDITS) {
    const current = row.content?.[edit.key];
    if (current === edit.to) {
      console.log(`SKIP  ${which}/${ROW}.${edit.key}  (already blank)`);
      continue;
    }
    /*
      Refuses on anything but the value this expects, so a line the owner has
      typed since is reported rather than wiped. The heading is the one field
      here somebody is most likely to have had an opinion about.
    */
    if (current !== edit.expect) {
      console.log(
        `SKIP  ${which}/${ROW}.${edit.key}  (edited since — on disk: ${JSON.stringify(current)})`,
      );
      skipped += 1;
      continue;
    }
    row.content[edit.key] = edit.to;
    changed += 1;
    console.log(`SET   ${which}/${ROW}.${edit.key}  ${JSON.stringify(edit.expect)} -> ""`);
  }

  if (row.background === "white") {
    console.log(`SKIP  ${which}/${ROW}.background  (already white)`);
  } else {
    console.log(`SET   ${which}/${ROW}.background  ${JSON.stringify(row.background)} -> "white"`);
    row.background = "white";
    changed += 1;
  }
}

console.log(`\n${changed} value(s) to change, ${skipped} skipped.`);

if (!APPLY) {
  console.log("\nThe fields stay editable — typing a heading back brings it back.");
  console.log("Dry run — nothing written. Re-run with --apply.");
  await mongoose.disconnect();
  process.exit(0);
}

if (changed === 0) {
  console.log("Nothing to write.");
  await mongoose.disconnect();
  process.exit(0);
}

next.version = version + 1;
next.draft.updatedAt = new Date().toISOString();
next.published.updatedAt = next.draft.updatedAt;

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  { $set: { data: next } },
);
if (result.modifiedCount !== 1) {
  console.log("FAIL: somebody published while this ran. Nothing was changed.");
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
let wrong = 0;
for (const which of ["draft", "published"]) {
  const row = after.data[which].sections.find((s) => s.instanceId === ROW);
  for (const edit of EDITS) {
    const value = row?.content?.[edit.key];
    if (value !== edit.to && value !== edit.expect) {
      console.log(`READBACK  ${which}/${ROW}.${edit.key} = ${JSON.stringify(value)}`);
      wrong += 1;
    }
  }
  if (row?.background !== "white") {
    console.log(`READBACK  ${which}/${ROW}.background = ${JSON.stringify(row?.background)}`);
    wrong += 1;
  }
  /*
    And the thing this must NOT have done. The tiles are drawn from the shop's
    own categories, and `maxCount` decides how many — blanking a heading has no
    business touching either.
  */
  if (row?.content?.maxCount !== 8) {
    console.log(`READBACK  ${which}/${ROW}.maxCount = ${JSON.stringify(row?.content?.maxCount)}`);
    wrong += 1;
  }
}

console.log(
  `\nwrote. data.version ${version} -> ${after.data.version}. readback mismatches: ${wrong}`,
);
await mongoose.disconnect();
process.exit(wrong ? 1 : 0);
