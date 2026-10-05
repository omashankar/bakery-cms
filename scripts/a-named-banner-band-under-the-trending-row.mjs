/**
 * A SECOND BANNER STRIP, NAMED, UNDER THE TRENDING ROW.
 *
 *   node --env-file=.env.local scripts/a-named-banner-band-under-the-trending-row.mjs
 *   …add --apply to write.
 *
 * NOT A NEW SECTION TYPE. `banner-strip` already exists and is already on the
 * page at order 3; this copies that instance and gives the copy a heading and
 * a link, which the band can carry now.
 *
 * The heading is a PLACEHOLDER, like the ones over the price-card rows. The
 * layout this is drawn from says "Personalized Gifts / Customized with Love
 * and Care" over its own band — that is a claim about a service, and about
 * goods this file has never seen. The shop writes its own.
 *
 * ONE banner, not three: the layout gives this band a single wide picture,
 * and with one there is nothing to turn over.
 *
 *   Export 1520 x 330 for the wide one, 760 x 400 for phones.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SOURCE = "banner-strip-1";
const ID = "banner-strip-2";
const AFTER = "trending-5";
const TITLE = "Gift ideas";

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

// One banner, and it points at a category the shop actually has.
const catalog = await db.collection("catalogs").findOne({});
const products = (await db.collection("products").find({}).toArray()).filter(
  (p) => p.status === "published",
);
const biggest = (catalog?.categories ?? [])
  .map((c) => ({
    ...c,
    count: products.filter(
      (p) =>
        (p.categoryIds ?? []).map(String).includes(String(c.id)) ||
        String(p.categoryId ?? "") === String(c.id),
    ).length,
  }))
  .filter((c) => c.count && c.image)
  .sort((a, b) => b.count - a.count)[0];
if (!biggest) throw new Error("no category with products and a picture to point at");

const CONTENT = {
  overline: "",
  title: TITLE,
  ctaLabel: "View all",
  ctaHref: "/store/collections",
  // The taller of the two. The strip under the banner grid keeps the thin one.
  shape: "banner",
  banners: JSON.stringify([
    {
      // A STOCK PLACEHOLDER at the right ratio, so the band can be seen. The
      // shop replaces it with its own artwork — 1520x120, and 760x200 for the
      // phone picture beside it.
      image: "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1520&h=330&fit=crop",
      mobileImage: "",
      label: biggest.name,
      href: `/store/collections/${biggest.slug}`,
    },
  ]),
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
    content: { ...source.content, ...CONTENT },
  };
  const out = [...sections.slice(0, anchor + 1), copy, ...sections.slice(anchor + 1)];
  return { sections: out.map((s, i) => ({ ...s, order: i })), note: `copied ${SOURCE}, placed after ${AFTER}` };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`  ${published.note}`);
console.log(`  heading ${JSON.stringify(TITLE)} (a placeholder), link "View all"`);
console.log(`  one banner, pointing at ${biggest.name} (/store/collections/${biggest.slug})`);
console.log(`  the picture is a stock placeholder at 1520x330 — the shop replaces it\n`);
const at = published.sections.findIndex((s) => s.instanceId === ID);
console.log("  around it:");
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
