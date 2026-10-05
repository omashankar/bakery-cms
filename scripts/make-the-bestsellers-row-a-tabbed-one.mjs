/**
 * THE BESTSELLERS ROW, WITH CATEGORY TABS.
 *
 *   node --env-file=.env.local scripts/make-the-bestsellers-row-a-tabbed-one.mjs
 *   …add --apply to write.
 *
 * The layout the shop is working from puts a "Bestsellers" heading beside a
 * row of category tabs. That needs a band that is about BOTH — the flag and
 * the category — which the tabbed rail can now do through its "Draw from"
 * setting.
 *
 * So `tabbed-rail-top` moves under the price cards, is told to draw from best
 * sellers, and is given the heading and the View-all link. The plain
 * `best-sellers` band goes back down the page where it was, because two rows
 * both claiming the shop's bestsellers is one row too many.
 *
 * THE TABS ARE THE CATEGORIES THAT ACTUALLY HOLD A BESTSELLER, worked out
 * from the catalogue below rather than guessed. A tab whose category has none
 * renders "Nothing here yet", which is honest and still looks broken.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const RAIL = "tabbed-rail-top";
const PLAIN = "best-sellers-6";
const AFTER = "category-price-cards-1";
const PLAIN_HOME = 18;

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

// ── what each tab would actually hold
const catalog = await db.collection("catalogs").findOne({});
const products = (await db.collection("products").find({}).toArray()).filter(
  (p) => p.status === "published" && p.isBestSeller,
);
const holding = (catalog?.categories ?? [])
  .map((c) => ({
    ...c,
    hits: products.filter(
      (p) =>
        (p.categoryIds ?? []).map(String).includes(String(c.id)) ||
        String(p.categoryId ?? "") === String(c.id),
    ),
  }))
  .filter((c) => c.hits.length)
  .sort((a, b) => b.hits.length - a.hits.length);

console.log(`  ${products.length} products carry the bestseller flag, across ${holding.length} categories:`);
for (const c of holding) {
  console.log(`    ${String(c.hits.length).padStart(2)}  ${c.name.padEnd(18)}${c.hits.map((p) => p.name).join(", ")}`);
}
console.log("");

const TABS = holding.map((c) => ({ label: c.name, categorySlug: c.slug }));
const CONTENT_PATCH = {
  overline: "",
  title: "Bestsellers",
  description: "",
  source: "best-sellers",
  maxCount: 8,
  ctaLabel: "View all",
  ctaHref: "/store/collections",
  tabs: JSON.stringify(TABS),
};

const store = await stores.findOne({ _id: "homepage-sections" });
const version = store?.data?.version;
if (typeof version !== "number") {
  console.log("no version on the homepage store — refusing to write");
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`version: ${version}`);

function rebuild(which) {
  let sections = (store.data?.[which]?.sections ?? []).slice().sort((a, b) => a.order - b.order);

  const rail = sections.find((s) => s.instanceId === RAIL);
  const plain = sections.find((s) => s.instanceId === PLAIN);
  if (!rail) throw new Error(`no such section: ${RAIL}`);
  if (!plain) throw new Error(`no such section: ${PLAIN}`);

  const patched = { ...rail, content: { ...rail.content, ...CONTENT_PATCH } };

  // the plain band steps aside first, then the tabbed one takes the slot
  sections = sections.filter((s) => s.instanceId !== RAIL && s.instanceId !== PLAIN);
  const anchor = sections.findIndex((s) => s.instanceId === AFTER);
  if (anchor < 0) throw new Error(`no such section to sit under: ${AFTER}`);

  const out = [...sections.slice(0, anchor + 1), patched, ...sections.slice(anchor + 1)];
  out.splice(Math.min(PLAIN_HOME, out.length), 0, plain);

  return { sections: out.map((s, i) => ({ ...s, order: i })) };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`  ${RAIL}: drawn from best sellers, ${TABS.length} tabs, heading "Bestsellers"`);
console.log(`  ${PLAIN}: moves back down to ${published.sections.findIndex((s) => s.instanceId === PLAIN)}`);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}\n`);
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
  result.matchedCount ? `  version ${version} -> ${version + 1}` : "  VERSION MOVED — nothing written, re-run",
);
await mongoose.disconnect();
