/**
 * A HEADING OVER THE SECOND ROW OF CATEGORY PRICE CARDS.
 *
 *   node --env-file=.env.local scripts/name-the-second-row-of-price-cards.mjs
 *   …add --apply to write.
 *
 * "More categories" is a PLACEHOLDER, exactly as "Shop by category" is over
 * the first row. It is deliberately the dullest true thing: it says what the
 * row is — four more of the shop's categories — and claims nothing about the
 * goods. The layout this is drawn from says "Flowers / Petals of Happiness"
 * over its own row, which is that shop's collection and that shop's line.
 *
 * The shop replaces both in the builder.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const ID = "category-price-cards-2";
const TITLE = "More categories";

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

const before = (store.data.published.sections ?? []).find((s) => s.instanceId === ID);
if (!before) throw new Error(`no such section: ${ID}`);
console.log(`  title: ${JSON.stringify(before.content?.title ?? "")} -> ${JSON.stringify(TITLE)}`);
console.log(`  the overline and the line under it stay blank — those are the shop's own words.`);

const patch = (list) =>
  list.map((s) => (s.instanceId === ID ? { ...s, content: { ...s.content, title: TITLE } } : s));

if (!APPLY) {
  console.log("\n  DRY RUN — nothing written.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  {
    $set: {
      "data.draft.sections": patch(store.data.draft.sections ?? []),
      "data.published.sections": patch(store.data.published.sections ?? []),
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
