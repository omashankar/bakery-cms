/**
 * THE PROMISES BAND MOVES UP, AND TAKES THE SHAPE THE SHOP ASKED FOR.
 *
 *   node --env-file=.env.local scripts/the-promises-strip-moves-up-under-the-banners.mjs
 *   …add --apply to write.
 *
 * NOTHING NEW IS CREATED. The shop asked for a band of four points — a small
 * picture, a bold line and a quieter line under it — directly under the pair
 * of banners. That band already exists and is already on this page: `why-us`,
 * sitting near the foot of the homepage with four points the shop wrote
 * itself, all of them true of this shop:
 *
 *   Custom designs · Eggless options · Photo cakes · Delivery in Kota
 *
 * So it moves rather than being written again, and its shape changes from
 * four bordered cards to the single tinted strip the shop held up. Its words
 * are NOT touched: they are the shop's, and they are already right.
 *
 * ITS BACKGROUND GOES TO WHITE, because in the strip shape the band draws its
 * own tinted panel — on `panel-sand` it would be a panel inside a panel.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const BAND = "why-us-12";
const AFTER = "banner-grid-pairs";

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log("db: " + db.databaseName);
console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");
console.log("");

const store = await stores.findOne({ _id: "homepage-sections" });
const version = store?.data?.version;
if (typeof version !== "number") {
  console.log("no version on the homepage store — refusing to write");
  await mongoose.disconnect();
  process.exit(1);
}
console.log("version: " + version);

function move(list) {
  const rows = (list ?? []).slice().sort((a, b) => a.order - b.order);
  const band = rows.find((s) => s.instanceId === BAND);
  const anchor = rows.findIndex((s) => s.instanceId === AFTER);
  if (!band) return { rows: null, why: BAND + " is not on the page" };
  if (anchor < 0) return { rows: null, why: AFTER + " is not on the page" };

  const moved = {
    ...band,
    background: "white",
    content: { ...band.content, layout: "strip" },
  };
  const rest = rows.filter((s) => s.instanceId !== BAND);
  const at = rest.findIndex((s) => s.instanceId === AFTER);
  const out = [...rest.slice(0, at + 1), moved, ...rest.slice(at + 1)];
  return { rows: out.map((s, i) => ({ ...s, order: i })), band, why: null };
}

const draft = move(store.data.draft.sections);
const published = move(store.data.published.sections);
if (published.why) {
  console.log("  " + published.why + " — refusing to guess");
  await mongoose.disconnect();
  process.exit(1);
}

const was = published.band;
console.log("  moving " + BAND + " from order " + was.order + " to just under " + AFTER);
console.log("  background " + was.background + " -> white, shape -> strip");
console.log("");
let tiles = [];
try { tiles = JSON.parse(was.content?.items ?? "[]"); } catch { tiles = []; }
console.log("  its four points, unchanged — the shop's own words:");
for (const tile of tiles) {
  console.log("    " + String(tile.title ?? "").padEnd(20) + String(tile.description ?? ""));
}
console.log("");
for (const s of published.rows.slice(Math.max(0, 9), 14)) {
  const mark = s.instanceId === BAND ? "MOVED" : "     ";
  console.log("    " + mark + " " + String(s.order).padStart(3) + "  " + s.type.padEnd(18) + s.instanceId);
}

if (!APPLY) {
  console.log("");
  console.log("  DRY RUN — nothing written.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  {
    $set: {
      "data.draft.sections": draft.rows ?? store.data.draft.sections,
      "data.published.sections": published.rows,
      "data.version": version + 1,
      updatedAt: new Date(),
    },
  },
);
console.log("");
console.log("  matched " + result.matchedCount + ", modified " + result.modifiedCount);
console.log(
  result.matchedCount
    ? "  version " + version + " -> " + (version + 1)
    : "  VERSION MOVED — nothing written, re-run",
);
await mongoose.disconnect();
