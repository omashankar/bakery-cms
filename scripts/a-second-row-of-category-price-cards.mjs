/**
 * A SECOND ROW OF CATEGORY PRICE CARDS, under the bestsellers.
 *
 *   node --env-file=.env.local scripts/a-second-row-of-category-price-cards.mjs
 *   …add --apply to write.
 *
 * NOT A NEW SECTION TYPE. `category-price-cards` already exists and is already
 * on the page at order 3; this copies that instance, moves the copy under the
 * bestsellers row, and fills it with the categories the first one does not use.
 * A shop with several collections makes one of these per collection.
 *
 * THE ADMIN CAN DO THIS WITHOUT A SCRIPT. The homepage builder's section list
 * has a Duplicate control (`handleDuplicateSection`), so the shop can copy this
 * row as many times as it has collections and change the categories in each.
 * This script exists to place the first copy, not because it is the only way.
 *
 * The four categories are worked out from the catalogue, not chosen here: the
 * ones with products, a price and a picture of their own, minus whatever the
 * existing row already shows.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const SOURCE = "category-price-cards-1";
const ID = "category-price-cards-2";
const AFTER = "tabbed-rail-top";
const TONES = ["rose", "mint", "sand", "sky"];
const HOW_MANY = 4;

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

const source = (store.data.published.sections ?? []).find((s) => s.instanceId === SOURCE);
if (!source) throw new Error(`nothing to copy: ${SOURCE}`);

const taken = new Set(
  JSON.parse(source.content?.items || "[]").map((i) => i.categorySlug),
);
console.log(`  the row already on the page shows: ${[...taken].join(", ")}\n`);

// ── the ones it does not, from the shop's own catalogue
const catalog = await db.collection("catalogs").findOne({});
const products = (await db.collection("products").find({}).toArray()).filter(
  (p) => p.status === "published",
);
const spare = (catalog?.categories ?? [])
  .map((c) => {
    const id = String(c.id);
    const mine = products.filter(
      (p) =>
        (p.categoryIds ?? []).map(String).includes(id) || String(p.categoryId ?? "") === id,
    );
    return { ...c, count: mine.length, sellable: mine.length > 0 };
  })
  .filter((c) => c.sellable && Boolean(c.image) && !taken.has(c.slug))
  .sort((a, b) => b.count - a.count)
  .slice(0, HOW_MANY);

if (spare.length < HOW_MANY) {
  console.log(`only ${spare.length} categories are left over — refusing to draw a short row`);
  await mongoose.disconnect();
  process.exit(1);
}

const CONTENT = {
  ...source.content,
  // BLANK. The first row's heading is a placeholder the shop still has to
  // replace; inventing a second one here would be two lines to undo instead
  // of one, and there is no honest name for this particular four.
  overline: "",
  title: "",
  items: JSON.stringify(
    spare.map((c, i) => ({
      categorySlug: c.slug,
      image: c.image,
      tone: TONES[i % TONES.length],
      label: "",
    })),
  ),
};

function rebuild(which) {
  const sections = (store.data?.[which]?.sections ?? []).slice().sort((a, b) => a.order - b.order);
  const existing = sections.find((s) => s.instanceId === ID);
  if (existing) {
    const out = sections.map((s) =>
      s.instanceId === ID ? { ...s, content: { ...s.content, ...CONTENT } } : s,
    );
    return { sections: out.map((s, i) => ({ ...s, order: i })), note: "updated in place" };
  }
  const anchor = sections.findIndex((s) => s.instanceId === AFTER);
  if (anchor < 0) throw new Error(`no such section to sit under: ${AFTER}`);
  const copy = {
    ...JSON.parse(JSON.stringify(source)),
    instanceId: ID,
    order: 0,
    isVisible: true,
    content: CONTENT,
  };
  const out = [...sections.slice(0, anchor + 1), copy, ...sections.slice(anchor + 1)];
  return { sections: out.map((s, i) => ({ ...s, order: i })), note: `copied ${SOURCE}, placed after ${AFTER}` };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`  ${published.note}`);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}\n`);
console.log("  the new row, as a customer would read it:");
for (const [i, c] of spare.entries()) {
  console.log(`    ${TONES[i % TONES.length].padEnd(5)}  ${c.name.padEnd(18)}${c.count} live`);
}
const at = published.sections.findIndex((s) => s.instanceId === ID);
console.log("\n  around it:");
for (const s of published.sections.slice(Math.max(0, at - 2), at + 3)) {
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
