/**
 * THE BESTSELLERS ROW, DIRECTLY UNDER THE CATEGORY PRICE CARDS.
 *
 *   node --env-file=.env.local scripts/bring-the-bestsellers-row-under-the-price-cards.mjs
 *   …add --apply to write.
 *
 * MOVES a band rather than adding one. The shop wanted the layout's
 * "Bestsellers" row in this position, and there is exactly one band on this
 * page entitled to that word: `best-sellers` selects on the product's own
 * isBestSeller flag. The tabbed rails beside it select on CATEGORY, so calling
 * one of those Bestsellers would be a claim about what sells that nothing in
 * the data backs.
 *
 * Nothing about its content is rewritten. It already carries the shop's own
 * heading, its own line under it and its own View-all link.
 *
 * WHY NO TABS, which the layout has: on this shop's catalogue there are 7
 * flagged bestsellers across 5 categories — 3 in Birthday and one each in
 * Pastries, Photo Cakes, Anniversary and Eggless. Tabs over that give a row of
 * one product per tab. The tabs are worth adding when more products are
 * flagged, not before.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const ID = "best-sellers-6";
const AFTER = "category-price-cards-1";

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

function rebuild(which) {
  const sections = (store.data?.[which]?.sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const moving = sections.find((s) => s.instanceId === ID);
  if (!moving) throw new Error(`no such section to move: ${ID}`);

  const rest = sections.filter((s) => s.instanceId !== ID);
  const anchor = rest.findIndex((s) => s.instanceId === AFTER);
  if (anchor < 0) throw new Error(`no such section to sit under: ${AFTER}`);

  const out = [...rest.slice(0, anchor + 1), moving, ...rest.slice(anchor + 1)];
  return { sections: out.map((s, i) => ({ ...s, order: i })), from: moving.order, moving };
}

const draft = rebuild("draft");
const published = rebuild("published");
const to = published.sections.findIndex((s) => s.instanceId === ID);

console.log(`  ${ID}: order ${published.from} -> ${to}`);
console.log(`  content untouched — heading "${published.moving.content?.title ?? ""}", link "${published.moving.content?.ctaLabel ?? ""}"`);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}  (moved, not added)\n`);
console.log("  the top of the page reads:");
for (const s of published.sections.slice(0, 7)) {
  console.log(`    ${String(s.order).padStart(2)}  ${s.type.padEnd(22)}${s.instanceId}`);
}

// What the row will actually hold, from the shop's own catalogue.
const products = (await db.collection("products").find({}).toArray()).filter(
  (p) => p.status === "published" && p.isBestSeller,
);
console.log(`\n  ${products.length} products carry the bestseller flag:`);
for (const p of products.slice(0, 8)) console.log(`    Rs ${String(p.price).padEnd(7)}${p.name}`);

if (!APPLY) {
  console.log("\n  DRY RUN — nothing written.");
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
      updatedAt: new Date(),
    },
  },
);
console.log(`\n  matched ${result.matchedCount}, modified ${result.modifiedCount}`);
console.log(
  result.matchedCount
    ? `  version ${version} -> ${version + 1}`
    : "  VERSION MOVED — nothing written, re-run",
);
await mongoose.disconnect();
