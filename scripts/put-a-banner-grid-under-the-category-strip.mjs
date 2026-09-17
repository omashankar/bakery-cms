/**
 * THE BANNER GRID, DIRECTLY UNDER THE CATEGORY STRIP.
 *
 *   node --env-file=.env.local scripts/put-a-banner-grid-under-the-category-strip.mjs
 *   …add --apply to write.
 *   …add --clear to empty it again (the band stays, its banners go).
 *
 * A band of finished artwork: the shop exports banners with their heading,
 * strapline and button already drawn in, and this grid shows them and nothing
 * else. Three wide over five narrow, which is what the layout asks for.
 *
 * The pictures here are STOCK PLACEHOLDERS so the arrangement can be seen. The
 * shop replaces each one with its own banner. What is real: every link points
 * at one of the shop's own categories, and each banner's screen-reader label
 * is that category's own name.
 *
 * Export sizes, for when the real artwork is made:
 *   wide   — 11:10, e.g. 1100x1000
 *   narrow — 2:3,   e.g. 800x1200
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const CLEAR = process.argv.includes("--clear");

const ID = "banner-grid-must-have";
const AFTER = "our-menu-1";

const img = (id, w, h) => `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop`;

const P = {
  decoratedCake: "photo-1464349153735-7db50ed83c84",
  weddingCake: "photo-1519225421980-715cb0215aed",
  blushCake: "photo-1621303837174-89787a7d4729",
  redVelvet: "photo-1586985289906-406988974504",
  berryCake: "photo-1535141192574-5d4897c12636",
  pastries: "photo-1486427944299-d1955d23e34d",
  stackCake: "photo-1542826438-bd32f43d626f",
  tiramisu: "photo-1571877227200-a0d98ea607e9",
};
const col = (slug) => `/store/collections/${slug}`;

/** Three wide, then five narrow. */
const BANNERS = [
  { photo: P.decoratedCake, label: "Birthday Cakes", slug: "birthday", wide: true },
  { photo: P.weddingCake, label: "Wedding Cakes", slug: "wedding", wide: true },
  { photo: P.blushCake, label: "Photo Cakes", slug: "photo-cakes", wide: true },
  { photo: P.redVelvet, label: "Eggless Cakes", slug: "eggless", wide: false },
  { photo: P.berryCake, label: "Seasonal", slug: "seasonal", wide: false },
  { photo: P.pastries, label: "Pastries", slug: "pastries", wide: false },
  { photo: P.stackCake, label: "Anniversary", slug: "anniversary", wide: false },
  { photo: P.tiramisu, label: "Premium", slug: "premium", wide: false },
];

const CONTENT = CLEAR
  ? { overline: "", title: "", banners: "[]" }
  : {
      overline: "",
      // The shop's own heading goes here; left blank rather than invented.
      title: "",
      banners: JSON.stringify(
        BANNERS.map((b) => ({
          image: b.wide ? img(b.photo, 1100, 1000) : img(b.photo, 800, 1200),
          label: b.label,
          href: col(b.slug),
          wide: b.wide ? "true" : "false",
        })),
      ),
    };

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(CLEAR ? "=== MODE: clear ===" : "=== MODE: add ===");
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
      type: "banner-grid",
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
console.log(`  banners: ${JSON.parse(CONTENT.banners).length}`);
console.log(
  `  sections: ${store.data.published.sections.length} -> ${published.sections.length}`,
);
const order = published.sections
  .slice(0, 5)
  .map((s) => `${s.order}:${s.type}`)
  .join("  ");
console.log(`  top of the page: ${order}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
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
      "data.updatedAt": new Date(),
    },
  },
);

if (result.matchedCount !== 1) {
  console.log("VERSION MOVED — nothing written.");
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
console.log(`\nWROTE. version ${version} -> ${after?.data?.version}`);

await mongoose.disconnect();
