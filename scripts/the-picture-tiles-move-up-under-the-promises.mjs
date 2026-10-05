/**
 * THE PICTURE TILES MOVE UP, AND TAKE THE CARD SHAPE.
 *
 *   node --env-file=.env.local scripts/the-picture-tiles-move-up-under-the-promises.mjs
 *   …add --apply to write.
 *
 * NOTHING NEW IS CREATED. The shop asked for a grid of labelled picture tiles
 * under the promises band. That band already exists and is already on this
 * page: `tile-grid-gifts`, sitting near the foot of the homepage with eleven
 * tiles the shop already filled in. It moves rather than being written again.
 *
 * Its SHAPE changes from plain to card — a bordered box, the picture at 4:3
 * across the top and the label in a tinted bar along the foot — which is the
 * layout the shop held up. Its tiles and its heading are not touched.
 *
 * ITS BACKGROUND GOES TO WHITE. On `cream` the cards would be a tinted box on
 * a tinted band; the layout being copied puts them on the page's own white.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const BAND = "tile-grid-gifts";
const AFTER = "why-us-12";

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
  if (!band) return { rows: null, why: BAND + " is not on the page" };
  const anchor = rows.findIndex((s) => s.instanceId === AFTER);
  if (anchor < 0) return { rows: null, why: AFTER + " is not on the page" };

  const moved = {
    ...band,
    background: "white",
    content: { ...band.content, shape: "card" },
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
console.log("  background " + was.background + " -> white, shape -> card");
console.log("");
let tiles = [];
try { tiles = JSON.parse(was.content?.tiles ?? "[]"); } catch { tiles = []; }
console.log("  its " + tiles.length + " tiles, unchanged — the shop's own:");
for (const tile of tiles) {
  console.log("    " + String(tile.label ?? "(no label)").padEnd(22) + (tile.href ?? "(no link)"));
}
console.log("");
for (const s of published.rows.slice(10, 16)) {
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
