/**
 * THE TRENDING ROW, DIRECTLY UNDER THE SECOND ROW OF PRICE CARDS.
 *
 *   node --env-file=.env.local scripts/bring-the-trending-row-under-the-second-price-cards.mjs
 *   …add --apply to write.
 *
 * MOVES a band rather than adding one. `trending` already exists, is already
 * on the page, and already carries the sand tint the layout gives this row.
 * Its heading, its link and its background are the shop's own and untouched.
 *
 * The design the shop held up beside it — heading ranged left, VIEW ALL
 * opposite, a row that scrolls — is not content and is not set here: every
 * product row on the page draws that way now.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const ID = "trending-5";
const AFTER = "category-price-cards-2";

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
  const sections = (store.data?.[which]?.sections ?? []).slice().sort((a, b) => a.order - b.order);
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
console.log(
  `  content untouched — heading ${JSON.stringify(published.moving.content?.title ?? "")}, ` +
    `link ${JSON.stringify(published.moving.content?.ctaLabel ?? "")}, tint ${published.moving.background}`,
);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}  (moved, not added)\n`);
console.log("  the top of the page reads:");
for (const s of published.sections.slice(0, 9)) {
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
  result.matchedCount ? `  version ${version} -> ${version + 1}` : "  VERSION MOVED — nothing written, re-run",
);
await mongoose.disconnect();
