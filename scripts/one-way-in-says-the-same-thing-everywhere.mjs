/**
 * EVERY WAY-IN SAYS THE SAME THING.
 *
 *   node --env-file=.env.local scripts/one-way-in-says-the-same-thing-everywhere.mjs
 *   …add --apply to write.
 *
 * Eight rows on this page say "View all". Five say something else, and four of
 * those five name the trade: "Shop Photo Cakes", "Shop Eggless", "Shop
 * Seasonal", "Shop Cakes", "View Wedding Cakes". On a page of a dozen rows the
 * button is furniture — a customer learns it once — and five spellings make it
 * read as five different controls.
 *
 * NOT TOUCHED: the contact band's "Contact Us". That button goes to a form,
 * not to more of the row above it, and calling it View all would be wrong.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SAYS = "View all";

/** The bands whose link is a way in to more of that row. */
const WAY_IN = new Set([
  "featured-cakes", "trending", "best-sellers", "photo-cakes", "eggless",
  "seasonal", "category-rail", "tabbed-rail", "category-price-cards",
  "banner-strip", "blog-cards", "wedding", "gallery",
]);

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
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

const changes = [];
const patch = (list) =>
  list.map((s) => {
    const label = s.content?.ctaLabel;
    if (!WAY_IN.has(s.type) || typeof label !== "string" || !label.trim() || label === SAYS) return s;
    changes.push({ id: s.instanceId, from: label, hidden: !s.isVisible });
    return { ...s, content: { ...s.content, ctaLabel: SAYS } };
  });

const published = patch(store.data.published.sections ?? []);
changes.length = 0;
const draft = patch(store.data.draft.sections ?? []);
changes.length = 0;
const finalPublished = patch(store.data.published.sections ?? []);

console.log(`  ${changes.length} buttons change:`);
for (const c of changes) {
  console.log(`    ${c.hidden ? "HID " : "    "}${c.id.padEnd(22)}${JSON.stringify(c.from)} -> ${JSON.stringify(SAYS)}`);
}
console.log(`\n  left alone: any band whose link is not a way in — the contact button keeps its own words.`);

if (!APPLY) {
  console.log("\n  DRY RUN — nothing written.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  {
    $set: {
      "data.draft.sections": draft,
      "data.published.sections": finalPublished,
      "data.version": version + 1,
      updatedAt: new Date(),
    },
  },
);
console.log(`\n  matched ${result.matchedCount}, modified ${result.modifiedCount}`);
console.log(
  result.matchedCount ? `  version ${version} -> ${version + 1}` : "  VERSION MOVED — nothing written, re-run",
);
await mongoose.disconnect();
