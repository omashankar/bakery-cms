/**
 * THE HOMEPAGE, IN THE ORDER THE SHOP ASKED FOR.
 *
 *   node --env-file=.env.local scripts/lay-the-homepage-out-the-way-the-shop-asked.mjs
 *   …add --apply to write. Without it this only prints what it would do.
 *
 * The shop is modelling its storefront on a reference layout. This moves the
 * bands into that ORDER and adds the five band types that order needs and this
 * homepage has never published. It copies no wording, no pictures and no
 * claims from anywhere: every new band is created EMPTY, and every band that
 * already exists keeps the content it already has.
 *
 * WHAT IT WILL NOT DO
 *
 * - It deletes nothing. Two bands are switched off (isVisible false) and stay
 *   in the document with their content intact, so turning them back on in the
 *   builder is one click.
 * - It invents no copy. The only strings it writes are the words "View all"
 *   on three rails that have no view-all link today, and tab labels that are
 *   the shop's OWN category names read from its own catalogue. Everything
 *   else a reader would call content is left blank for the owner.
 *
 * WHY BOTH LISTS
 *
 * The builder preview and ?preview render `data.draft`, the live page renders
 * `data.published` (features/cms-sections/server/homepage-sections.server.ts).
 * Writing one and not the other leaves the builder showing an order the
 * storefront does not have, and the builder's dirty check compares the two.
 *
 * WHY THE VERSION IS PINNED
 *
 * `data.version` is 21 as this was written. If somebody publishes from the
 * builder in between, the update matches nothing and writes nothing rather
 * than overwriting their work.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const EXPECT_VERSION = 21;

/**
 * The order, by instanceId.
 *
 * Existing ids are reused ON PURPOSE: the band keeps the content the owner
 * already has. A new id here means a band this homepage has never carried.
 */
const ORDER = [
  { id: "hero-0", bg: "white" },
  { id: "our-menu-1", bg: "white" },
  { id: "promo-banner-2", bg: "white" },
  { id: "promo-collage-mosaic", bg: "cream", type: "promo-collage" },
  { id: "featured-cakes-4", bg: "white" },
  { id: "tabbed-rail-top", bg: "cream", type: "tabbed-rail" },
  { id: "offers-7", bg: "white" },
  { id: "category-rail-birthday", bg: "cream", type: "category-rail" },
  { id: "trending-5", bg: "white" },
  { id: "wedding-8", bg: "cream" },
  { id: "photo-cakes-9", bg: "white" },
  { id: "why-us-12", bg: "cream" },
  { id: "eggless-10", bg: "white" },
  { id: "seasonal-11", bg: "cream" },
  { id: "tabbed-rail-lower", bg: "white", type: "tabbed-rail" },
  { id: "best-sellers-6", bg: "cream" },
  { id: "categories-3", bg: "white" },
  { id: "store-locator-16", bg: "cream" },
  { id: "seo-prose-about", bg: "white", type: "seo-prose" },
  { id: "blog-cards-latest", bg: "cream", type: "blog-cards" },
  { id: "newsletter-17", bg: "white" },
  { id: "cta-18", bg: "white" },
];

/**
 * Switched OFF, not removed.
 *
 * gallery-14 — every one of its twelve pictures is a stock photo URL carrying
 *   a seeded product name. On the live page that band presents other people's
 *   photographs as this kitchen's own work, under the heading "Some of what
 *   has come out of our kitchen". Off until the shop puts its own pictures in.
 * instagram-15 — has no `posts` key at all, so it already draws nothing. Being
 *   "on" while rendering nothing is the state that makes a builder confusing.
 */
const SWITCH_OFF = ["gallery-14", "instagram-15"];

/** Content for bands that do not exist yet. Empty, except where noted. */
const NEW_CONTENT = {
  "promo-collage-mosaic": {
    overline: "",
    title: "",
    description: "",
    // The mosaic of small promo tiles. Empty: every tile is a picture and a
    // line of the shop's own wording.
    cards: "[]",
  },
  "tabbed-rail-top": {
    overline: "",
    title: "",
    description: "",
    maxCount: 4,
    // The labels are the shop's OWN category names, read from its catalogue,
    // and each tab shows that category's real products. Nothing invented.
    tabs: JSON.stringify([
      { label: "Birthday Cakes", categorySlug: "birthday" },
      { label: "Wedding Cakes", categorySlug: "wedding" },
      { label: "Photo Cakes", categorySlug: "photo-cakes" },
    ]),
  },
  "category-rail-birthday": {
    categorySlug: "birthday",
    overline: "",
    title: "Birthday Cakes",
    description: "",
    maxCount: 4,
    ctaLabel: "View all",
    ctaHref: "/store/collections/birthday",
  },
  "tabbed-rail-lower": {
    overline: "",
    title: "",
    description: "",
    maxCount: 4,
    tabs: JSON.stringify([
      { label: "Eggless Cakes", categorySlug: "eggless" },
      { label: "Seasonal", categorySlug: "seasonal" },
      { label: "Anniversary", categorySlug: "anniversary" },
    ]),
  },
  "seo-prose-about": { overline: "", title: "", blocks: "[]" },
  "blog-cards-latest": {
    overline: "",
    title: "",
    description: "",
    ctaLabel: "",
    ctaHref: "",
    posts: "[]",
  },
};

/**
 * The reference puts a view-all on every product rail's heading line. Three of
 * this shop's rails have no link at all, so the control is absent rather than
 * differently worded. "View all" is navigation, not a claim.
 */
const ADD_VIEW_ALL = {
  "featured-cakes-4": { ctaLabel: "View all", ctaHref: "/store/collections" },
  "trending-5": { ctaLabel: "View all", ctaHref: "/store/collections" },
  "best-sellers-6": { ctaLabel: "View all", ctaHref: "/store/collections" },
};

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

const store = await stores.findOne({ _id: "homepage-sections" });
if (!store) {
  console.log("no homepage-sections document — nothing to do");
  await mongoose.disconnect();
  process.exit(1);
}
if (store.data?.version !== EXPECT_VERSION) {
  console.log(
    `version is ${store.data?.version}, expected ${EXPECT_VERSION}. ` +
      "Somebody has published since this was written — re-read before running.",
  );
  await mongoose.disconnect();
  process.exit(1);
}

function rebuild(which) {
  const existing = new Map(
    (store.data?.[which]?.sections ?? []).map((s) => [s.instanceId, s]),
  );
  const seen = new Set();
  const out = [];
  const ledger = [];

  ORDER.forEach((row, index) => {
    const was = existing.get(row.id);
    if (was) {
      seen.add(row.id);
      const content = { ...(was.content ?? {}), ...(ADD_VIEW_ALL[row.id] ?? {}) };
      const changes = [];
      if (was.order !== index) changes.push(`order ${was.order}->${index}`);
      if (was.background !== row.bg) changes.push(`bg ${was.background}->${row.bg}`);
      if (was.isVisible === false) changes.push("back ON");
      if (ADD_VIEW_ALL[row.id]) changes.push("+view-all");
      out.push({ ...was, order: index, background: row.bg, isVisible: true, content });
      ledger.push(
        `${String(index).padStart(2)}  KEEP  ${(was.type ?? "").padEnd(15)} ${row.id.padEnd(23)}` +
          (changes.length ? `  (${changes.join(", ")})` : "  (unchanged)"),
      );
      return;
    }

    const content = NEW_CONTENT[row.id];
    if (!content) throw new Error(`no content defined for new section ${row.id}`);
    out.push({
      instanceId: row.id,
      type: row.type,
      order: index,
      isVisible: true,
      background: row.bg,
      content,
    });
    const blanks = Object.entries(content)
      .filter(([, v]) => v === "" || v === "[]")
      .map(([k]) => k);
    ledger.push(
      `${String(index).padStart(2)}  NEW   ${(row.type ?? "").padEnd(15)} ${row.id.padEnd(23)}` +
        `  (blank: ${blanks.join(",") || "none"})`,
    );
  });

  // Everything the order did not name keeps its content and goes to the end,
  // off. Nothing is dropped.
  let tail = out.length;
  for (const [id, was] of existing) {
    if (seen.has(id)) continue;
    const off = SWITCH_OFF.includes(id) || was.isVisible === false;
    out.push({ ...was, order: tail, isVisible: !off });
    ledger.push(
      `${String(tail).padStart(2)}  ${off ? "OFF  " : "KEEP "} ${(was.type ?? "").padEnd(15)} ${id.padEnd(23)}` +
        (off ? "  (kept in the document, hidden on the page)" : "  (not in the new order)"),
    );
    tail += 1;
  }

  return { sections: out, ledger };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`--- draft: ${store.data.draft?.sections?.length ?? 0} -> ${draft.sections.length}`);
for (const line of draft.ledger) console.log("  " + line);
console.log(
  `\n--- published: ${store.data.published?.sections?.length ?? 0} -> ${published.sections.length}`,
);
for (const line of published.ledger) console.log("  " + line);

const before = store.data.published?.sections?.length ?? 0;
console.log(
  `\nsummary: ${before} bands in, ${published.sections.length} out; ` +
    `${ORDER.length} in the new order, ${published.sections.length - ORDER.length} parked at the end. ` +
    "Nothing deleted.",
);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": EXPECT_VERSION },
  {
    $set: {
      "data.draft.sections": draft.sections,
      "data.published.sections": published.sections,
      "data.version": EXPECT_VERSION + 1,
      "data.updatedAt": new Date(),
    },
  },
);

if (result.matchedCount !== 1) {
  console.log("VERSION MOVED — nothing written. Re-read and run again.");
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
console.log(`\nWROTE. version ${store.data.version} -> ${after?.data?.version}`);
console.log(
  `readback: draft ${after?.data?.draft?.sections?.length}, ` +
    `published ${after?.data?.published?.sections?.length}`,
);
const order = (after?.data?.published?.sections ?? [])
  .slice()
  .sort((a, b) => a.order - b.order)
  .map((s) => `${s.order}:${s.type}${s.isVisible === false ? "(off)" : ""}`);
console.log("readback order: " + order.join("  "));

await mongoose.disconnect();
