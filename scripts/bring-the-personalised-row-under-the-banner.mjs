/**
 * THE PERSONALISED ROW, DIRECTLY UNDER THE NAMED BANNER BAND.
 *
 *   node --env-file=.env.local scripts/bring-the-personalised-row-under-the-banner.mjs
 *   …add --apply to write.
 *
 * MOVES a band rather than adding one, and changes NO copy.
 *
 * `photo-cakes` already exists, is already on the page, and already carries
 * the shop's own words: overline "Personalised", title "Photo Cakes". It
 * selects the products a customer can put a photograph on — six of them here.
 *
 * WHAT IS NOT SET is the word "Bestsellers" the layout puts over its own row.
 * This band does not select on the bestseller flag: two of those six carry it,
 * and a heading claiming otherwise is a claim about what sells that nothing
 * here can check. The shop writes its own heading.
 *
 * The tint is the sky panel, which is what that layout gives this row — and
 * the band above it is sky too, so it is one click in the builder to change.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const ID = "photo-cakes-9";
const AFTER = "banner-strip-2";
const TINT = "panel-sky";

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
  const placed = { ...moving, background: TINT };
  const out = [...rest.slice(0, anchor + 1), placed, ...rest.slice(anchor + 1)];
  return { sections: out.map((s, i) => ({ ...s, order: i })), from: moving.order, moving };
}

const draft = rebuild("draft");
const published = rebuild("published");
const to = published.sections.findIndex((s) => s.instanceId === ID);

console.log(`  ${ID}: order ${published.from} -> ${to}`);
console.log(
  `  copy untouched — ${JSON.stringify(published.moving.content?.overline ?? "")} / ` +
    `${JSON.stringify(published.moving.content?.title ?? "")}, link ` +
    `${JSON.stringify(published.moving.content?.ctaLabel ?? "")}`,
);
console.log(`  tint: ${published.moving.background} -> ${TINT}`);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}  (moved, not added)\n`);

const products = (await db.collection("products").find({}).toArray()).filter(
  (p) => p.status === "published" && p.allowsPhotoUpload,
);
console.log(`  ${products.length} products a customer can put a photograph on:`);
for (const p of products.slice(0, 8)) console.log(`    Rs ${String(p.price).padEnd(7)}${p.name}`);

console.log("\n  around it:");
for (const s of published.sections.slice(Math.max(0, to - 2), to + 3)) {
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
