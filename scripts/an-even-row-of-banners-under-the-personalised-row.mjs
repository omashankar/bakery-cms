/**
 * AN EVEN ROW OF BANNERS, UNDER THE PERSONALISED ROW.
 *
 *   node --env-file=.env.local scripts/an-even-row-of-banners-under-the-personalised-row.mjs
 *   …add --apply to write.
 *
 * The shop asked for a band it can set to two or three banners across and
 * then fill with its own artwork. That band already existed: `banner-grid`
 * draws pictures and a link round each one and writes nothing over them,
 * which is what artwork with its words baked in needs. What it could not do
 * was an EVEN row — it only had the fifteen-column collage, wide cards beside
 * narrow ones. So the section gained a "Banners per row" setting and this
 * puts one on the page, set to two.
 *
 * NOT `promo-collage`, which is the other two-card band on this page. That
 * one draws a title, a line under it and a button ON TOP of the picture, and
 * the artwork this is for already has all three drawn into it.
 *
 * THE PICTURES ARE PLACEHOLDERS, at exactly the size the editor asks for
 * (750 x 290), so the band can be looked at before the shop has exported
 * anything. They carry no words, no offer and no screen-reader label, because
 * nothing here has seen the shop's artwork and an invented one would be a
 * claim this software made on the shop's behalf. Replace them in the builder.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** It goes directly under this one. */
const AFTER = "photo-cakes-9";
const ID = "banner-grid-pairs";

const BANNERS = [
  {
    image: "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=750&h=290&fit=crop",
    label: "",
    href: "/store/collections",
  },
  {
    image: "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?w=750&h=290&fit=crop",
    label: "",
    href: "/store/collections",
  },
];

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
  type: "banner-grid",
  order: 0,
  isVisible: true,
  background: "white",
  content: {
    overline: "",
    title: "",
    columns: "2",
    banners: JSON.stringify(BANNERS),
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
console.log("  everything below it moves down one.");
console.log("");
for (const s of published.rows.slice(Math.max(0, published.at - 1), published.at + 4)) {
  const mark = s.instanceId === ID ? "NEW " : "    ";
  console.log("    " + mark + String(s.order).padStart(3) + "  " + s.type.padEnd(18) + s.instanceId);
}
console.log("");
console.log("  set to: " + BANNERS.length + " banners, 2 across, placeholder pictures at 750 x 290");

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
