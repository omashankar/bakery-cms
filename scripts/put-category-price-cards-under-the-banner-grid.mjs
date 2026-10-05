/**
 * A ROW OF CATEGORY CARDS, DIRECTLY UNDER THE BANNER GRID.
 *
 *   node --env-file=.env.local scripts/put-category-price-cards-under-the-banner-grid.mjs
 *   …add --apply to write.
 *   …add --clear to empty it again (the band stays, its cards go).
 *
 * THE PRICE IS NOT WRITTEN HERE, and that is the whole design of this band.
 * Each card shows the cheapest live product in its category, read at render
 * time from the rail the server already built. A number typed into this script
 * would be a price the shop cannot keep true — it edits a product, the card
 * keeps advertising last month's figure, and the customer lands on a page that
 * disagrees with the card that sent them.
 *
 * What is real here: every card points at one of the shop's own categories and
 * carries that category's own picture and name.
 *
 * What is a PLACEHOLDER: the title. The shop writes its own heading and its own
 * line under it — neither is invented here.
 *
 * The tint reads best behind a cut-out picture (a transparent PNG of the
 * product with no background of its own), which is what the layout this is
 * drawn from uses. The category photographs sit on it inset instead, which
 * shows the arrangement until the shop exports its own.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const CLEAR = process.argv.includes("--clear");

const ID = "category-price-cards-1";
const AFTER = "banner-grid-must-have";

/** The four tints the layout uses, in its order. */
const TONES = ["rose", "mint", "sand", "sky"];

/** How many cards the row holds. Four across is what the layout draws. */
const HOW_MANY = 4;

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(CLEAR ? "=== MODE: clear ===" : "=== MODE: add ===");
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

// ── the cards, built from the shop's own catalogue
const catalog = await db.collection("catalogs").findOne({});
const products = await db.collection("products").find({}).toArray();
const live = products.filter((p) => (p.status ?? "published") === "published");

const ranked = (catalog?.categories ?? [])
  .map((c) => {
    const id = String(c.id);
    const mine = live.filter(
      (p) => (p.categoryIds ?? []).map(String).includes(id) || String(p.categoryId ?? "") === id,
    );
    const prices = mine.map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0);
    return { ...c, count: mine.length, from: prices.length ? Math.min(...prices) : null };
  })
  // Only categories a customer can actually buy from, and only ones with a
  // picture — a card with neither is a hole in the row.
  .filter((c) => c.from !== null && Boolean(c.image))
  .sort((a, b) => b.count - a.count)
  .slice(0, HOW_MANY);

if (!CLEAR && ranked.length < HOW_MANY) {
  console.log(`only ${ranked.length} categories qualify — refusing to draw a short row`);
  await mongoose.disconnect();
  process.exit(1);
}

const ITEMS = ranked.map((c, i) => ({
  categorySlug: c.slug,
  image: c.image,
  tone: TONES[i % TONES.length],
  // Blank: the card falls back to the category's own name, so renaming the
  // category renames the card instead of leaving a second copy behind.
  label: "",
}));

const CONTENT = CLEAR
  ? { overline: "", title: "", description: "", ctaLabel: "", ctaHref: "", priceLabel: "Starting from", items: "[]" }
  : {
      overline: "",
      // A navigational label, not a claim. The shop replaces it.
      title: "Shop by category",
      // LEFT BLANK. The line under the heading is the shop's own voice, and an
      // adjective invented here would be a claim this CMS cannot stand behind.
      description: "",
      ctaLabel: "View all",
      ctaHref: "/store/collections",
      priceLabel: "Starting from",
      items: JSON.stringify(ITEMS),
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
      type: "category-price-cards",
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
console.log(
  `  sections: ${store.data.published.sections.length} -> ${published.sections.length}\n`,
);
if (!CLEAR) {
  console.log("  the row, as a customer would read it:");
  for (const [i, c] of ranked.entries()) {
    console.log(
      `    ${TONES[i % TONES.length].padEnd(5)}  ${c.name.padEnd(16)}  Starting from Rs ${String(c.from).padEnd(6)}  (${c.count} live)`,
    );
  }
  console.log("\n  …and every one of those prices is READ, not stored.");
}

const around = published.sections
  .map((s, i) => `${i}:${s.type}`)
  .slice(Math.max(0, published.sections.findIndex((s) => s.instanceId === ID) - 2), undefined)
  .slice(0, 5)
  .join("  ");
console.log(`\n  order around it: ${around}`);

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
console.log(result.matchedCount ? `  version ${version} -> ${version + 1}` : "  VERSION MOVED — nothing written, re-run");
await mongoose.disconnect();
