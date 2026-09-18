/**
 * A WIDE BANNER STRIP THAT TURNS OVER.
 *
 *   node --env-file=.env.local scripts/put-a-turning-banner-strip-on-the-page.mjs
 *   …add --apply to write.
 *   …add --clear to empty it again (the band stays, its banners go).
 *
 * One full-width picture at a time, cross-fading every few seconds. The shop
 * exports the artwork with its words, offer and button already drawn in, which
 * is why this band paints nothing on top of it.
 *
 * THE PICTURES HERE ARE STOCK PLACEHOLDERS, at the right ratio so the
 * arrangement can be seen. The shop replaces each one with its own.
 *
 *   Wide strip — export 1520x120
 *
 * What is real: every link points at one of the shop's own categories, and
 * each banner's screen-reader label is that category's own name.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const CLEAR = process.argv.includes("--clear");

const ID = "banner-strip-1";
const AFTER = "tabbed-rail-top";
const SECONDS = 5;

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(CLEAR ? "=== MODE: clear ===" : "=== MODE: add ===");
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

// Three of the shop's own categories, so the links go somewhere real.
const catalog = await db.collection("catalogs").findOne({});
const products = (await db.collection("products").find({}).toArray()).filter(
  (p) => p.status === "published",
);
const withStock = (catalog?.categories ?? [])
  .map((c) => ({
    ...c,
    hits: products.filter(
      (p) =>
        (p.categoryIds ?? []).map(String).includes(String(c.id)) ||
        String(p.categoryId ?? "") === String(c.id),
    ).length,
  }))
  .filter((c) => c.hits)
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 3);

const strip = (id) => `https://images.unsplash.com/${id}?w=1520&h=120&fit=crop`;
const PHOTOS = [
  "photo-1486427944299-d1955d23e34d",
  "photo-1464349153735-7db50ed83c84",
  "photo-1535141192574-5d4897c12636",
];

const BANNERS = withStock.map((c, i) => ({
  image: strip(PHOTOS[i % PHOTOS.length]),
  label: c.name,
  href: `/store/collections/${c.slug}`,
}));

const CONTENT = CLEAR
  ? { banners: "[]", seconds: SECONDS, shape: "wide" }
  : { banners: JSON.stringify(BANNERS), seconds: SECONDS, shape: "wide" };

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
  const existing = sections.find((s) => s.instanceId === ID);

  if (existing) {
    const out = sections.map((s) =>
      s.instanceId === ID ? { ...s, content: { ...s.content, ...CONTENT } } : s,
    );
    return { sections: out.map((s, i) => ({ ...s, order: i })), note: "updated in place" };
  }
  if (CLEAR) return { sections, note: "not there — nothing to clear" };

  const anchor = sections.findIndex((s) => s.instanceId === AFTER);
  if (anchor < 0) throw new Error(`no such section to sit under: ${AFTER}`);

  const out = [
    ...sections.slice(0, anchor + 1),
    {
      instanceId: ID,
      type: "banner-strip",
      order: 0,
      isVisible: true,
      background: "white",
      content: CONTENT,
    },
    ...sections.slice(anchor + 1),
  ];
  return { sections: out.map((s, i) => ({ ...s, order: i })), note: `inserted after ${AFTER}` };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`  ${published.note}`);
console.log(`  sections: ${store.data.published.sections.length} -> ${published.sections.length}`);
if (!CLEAR) {
  console.log(`  ${BANNERS.length} banners, turning every ${SECONDS}s, shape wide (1520x120)\n`);
  for (const b of BANNERS) console.log(`    ${b.label.padEnd(18)}-> ${b.href}`);
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
