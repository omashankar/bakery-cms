/**
 * A BAND OF WHAT THIS BROWSER HAS LOOKED AT, UNDER THE PICTURE TILES.
 *
 *   node --env-file=.env.local scripts/a-band-of-what-this-browser-has-looked-at.mjs
 *   …add --apply to write.
 *
 * NOT A NEW MECHANISM. The shop already records what a visitor opens —
 * `recordRecentlyViewedProduct` has been called from the product page all
 * along, and the cart already draws a row from it. This puts the same thing on
 * the homepage as a band the shop can name, position and cap.
 *
 * IT HAS NO CONTENT TO SEED, and that is the point: the products come from the
 * visitor's own browser. A first-time visitor has looked at nothing and the
 * band draws nothing at all — no heading over an empty strip. The builder says
 * so rather than vanishing, so an admin can still select it.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const ID = "recently-viewed-1";
const AFTER = "tile-grid-gifts";

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

const band = {
  instanceId: ID,
  type: "recently-viewed",
  order: 0,
  isVisible: true,
  background: "cream",
  content: {
    overline: "",
    title: "Recently viewed",
    align: "",
    ctaLabel: "",
    ctaHref: "",
    maxCount: 8,
  },
};

function place(list) {
  const rows = (list ?? []).slice().sort((a, b) => a.order - b.order);
  if (rows.some((s) => s.instanceId === ID)) return { rows: null, at: -1 };
  const at = rows.findIndex((s) => s.instanceId === AFTER);
  if (at < 0) return { rows: null, at: -2 };
  const out = [...rows.slice(0, at + 1), band, ...rows.slice(at + 1)];
  return { rows: out.map((s, i) => ({ ...s, order: i })), at };
}

const draft = place(store.data.draft.sections);
const published = place(store.data.published.sections);

if (published.at === -1) {
  console.log("  " + ID + " is already on the page — nothing to do");
  await mongoose.disconnect();
  process.exit(0);
}
if (published.at === -2) {
  console.log("  " + AFTER + " is not on the page — refusing to guess where this goes");
  await mongoose.disconnect();
  process.exit(1);
}

console.log("  goes in at order " + (published.at + 1) + ", directly under " + AFTER);
console.log("");
for (const s of published.rows.slice(Math.max(0, published.at - 1), published.at + 4)) {
  const mark = s.instanceId === ID ? "NEW " : "    ";
  console.log("    " + mark + String(s.order).padStart(3) + "  " + s.type.padEnd(18) + s.instanceId);
}
console.log("");
console.log("  it carries no products: those come from each visitor's own browser,");
console.log("  and a visitor who has looked at nothing sees no band at all.");

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
