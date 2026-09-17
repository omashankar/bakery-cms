/**
 * THE TABBED RAIL, DIRECTLY UNDER THE CATEGORY PRICE CARDS.
 *
 *   node --env-file=.env.local scripts/bring-the-tabbed-rail-under-the-price-cards.mjs
 *   …add --apply to write.
 *
 * MOVES an existing band rather than adding another. The homepage already has
 * two tabbed rails — `tabbed-rail-top` at order 7 and `tabbed-rail-lower` at
 * 17 — and a third would be the same row three times. The shop asked for this
 * shape directly under the price cards, so the top one goes there.
 *
 * It also gains its View-all link, which the layout has and this band did not:
 * `ViewAllLink` draws nothing unless BOTH a label and a href are set, so the
 * button has been silently absent.
 *
 * WHAT IS NOT SET HERE is the heading. The layout this is drawn from says
 * "Bestsellers" over it, and these tabs are CATEGORIES — birthday, wedding,
 * photo cakes. Writing "Bestsellers" over a category listing is a claim about
 * what sells that this file cannot check; the shop has a `best-sellers` band
 * further down that reads the real flag. The heading box is left for the shop.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const ID = "tabbed-rail-top";
const AFTER = "category-price-cards-1";

const CONTENT_PATCH = {
  ctaLabel: "View all",
  ctaHref: "/store/collections",
};

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

  const patched = { ...moving, content: { ...moving.content, ...CONTENT_PATCH } };
  const rest = sections.filter((s) => s.instanceId !== ID);
  const anchor = rest.findIndex((s) => s.instanceId === AFTER);
  if (anchor < 0) throw new Error(`no such section to sit under: ${AFTER}`);

  const out = [...rest.slice(0, anchor + 1), patched, ...rest.slice(anchor + 1)];
  return { sections: out.map((s, i) => ({ ...s, order: i })), from: moving.order };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`  ${ID}: order ${published.from} -> ${published.sections.findIndex((s) => s.instanceId === ID)}`);
console.log(`  gains: ${JSON.stringify(CONTENT_PATCH)}`);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}  (moved, not added)\n`);
console.log("  the top of the page reads:");
for (const s of published.sections.slice(0, 7)) {
  console.log(`    ${String(s.order).padStart(2)}  ${s.type.padEnd(22)}${s.instanceId}`);
}

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
