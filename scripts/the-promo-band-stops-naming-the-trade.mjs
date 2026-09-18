/**
 * THE PROMO BAND'S BUTTON STOPS NAMING THE TRADE.
 *
 *   node --env-file=.env.local scripts/the-promo-band-stops-naming-the-trade.mjs
 *   …add --apply to write.
 *
 * The pass that made every way-in say "View all" deliberately skipped this
 * band, because a promo card's button is not a way in to the row above it —
 * it goes wherever the offer goes. That was right about the SHAPE and wrong
 * about the WORDS: the card still said "Shop Cakes" on a shop that sells more
 * than cakes, which is the thing this CMS is not allowed to assume.
 *
 * So the words change and the shape does not. "Shop now" is what the renderer
 * already falls back to when a card has no label of its own, so a shop that
 * never touches this box and one that had the old value now read the same.
 *
 * A LABEL A SHOP WROTE ITSELF IS LEFT ALONE. Only the shipped-era wording is
 * replaced; anything else in the box is that shop's own copy.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SAYS = "Shop now";

/** The wordings this CMS put there, not the shop. Compared case-insensitively. */
const OURS = new Set(["shop cakes", "shop now", "shop all", "order now", "buy now"]);

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

const seen = [];
const patch = (list, log) =>
  (list ?? []).map((s) => {
    if (s.type !== "promo-banner") return s;
    const label = s.content?.ctaLabel;
    if (typeof label !== "string" || !label.trim()) return s;
    const ours = OURS.has(label.trim().toLowerCase());
    if (log) seen.push({ id: s.instanceId, from: label, ours, hidden: !s.isVisible });
    if (!ours || label === SAYS) return s;
    return { ...s, content: { ...s.content, ctaLabel: SAYS } };
  });

const draft = patch(store.data.draft.sections, false);
const published = patch(store.data.published.sections, true);

console.log("  promo bands carrying a button label: " + seen.length);
for (const c of seen) {
  const mark = c.ours ? "->  " : "KEEP";
  const to = c.ours ? JSON.stringify(SAYS) : "(the shop wrote this)";
  console.log("    " + (c.hidden ? "HID " : "    ") + c.id.padEnd(20) + JSON.stringify(c.from).padEnd(16) + mark + " " + to);
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
      "data.draft.sections": draft,
      "data.published.sections": published,
      "data.version": version + 1,
      updatedAt: new Date(),
    },
  },
);
console.log("");
console.log("  matched " + result.matchedCount + ", modified " + result.modifiedCount);
console.log(result.matchedCount ? "  version " + version + " -> " + (version + 1) : "  VERSION MOVED — nothing written, re-run");
await mongoose.disconnect();
