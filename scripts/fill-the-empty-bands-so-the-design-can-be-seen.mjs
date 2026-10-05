/**
 * A DEMO OF THE LAYOUT, WITH PLACEHOLDER CONTENT IN THE EMPTY BANDS.
 *
 *   node --env-file=.env.local scripts/fill-the-empty-bands-so-the-design-can-be-seen.mjs
 *   …add --apply to write.
 *   …add --clear to put every one of these bands back to empty.
 *
 * Six bands ship empty on purpose and therefore draw nothing, which makes the
 * page impossible to look at as a whole. The shop asked to SEE the design
 * before the content exists, so this fills them.
 *
 * WHAT IS REAL AND WHAT IS NOT
 *
 * Real, and worth keeping: every tile and card here is named after one of the
 * shop's OWN eleven categories and links to that category's real collection
 * page. The trust strip's four rows are each backed by something in the
 * catalogue — eggless and photo cakes are product flags this shop actually
 * sets, and the city is the one in its own store locator.
 *
 * Placeholder, and to be replaced: the photographs are stock, and the prose
 * block and the three blog cards are generic text nobody at this shop wrote.
 * Those three are the first things to change before anyone sees this for real.
 * `--clear` empties every band this script fills, so none of it is sticky.
 *
 * Not filled: the international row. This shop delivers in one city, and a row
 * of country tiles is a promise it cannot keep. It stays switched off.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const CLEAR = process.argv.includes("--clear");

const img = (id, w = 600, h = 600) =>
  `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop`;

/** The verified ids this repo already uses for demo content. */
const P = {
  chocolateCake: "photo-1578985545062-69928b1d9587",
  pastries: "photo-1486427944299-d1955d23e34d",
  weddingCake: "photo-1519225421980-715cb0215aed",
  brownieCake: "photo-1603532648955-039310d9ed75",
  tiramisu: "photo-1571877227200-a0d98ea607e9",
  cupcakes: "photo-1535254973040-607b474cb50d",
  cookies: "photo-1558961363-fa8fdf82db35",
  stackCake: "photo-1542826438-bd32f43d626f",
  dessertPlate: "photo-1562440499-64c9a111f713",
  decoratedCake: "photo-1464349153735-7db50ed83c84",
  berryCake: "photo-1535141192574-5d4897c12636",
  blushCake: "photo-1621303837174-89787a7d4729",
  redVelvet: "photo-1586985289906-406988974504",
};

const col = (slug) => `/store/collections/${slug}`;

/** The shop's own categories, in its own words, with its own links. */
const CATEGORIES = [
  { name: "Birthday Cakes", slug: "birthday", photo: P.decoratedCake },
  { name: "Wedding Cakes", slug: "wedding", photo: P.weddingCake },
  { name: "Photo Cakes", slug: "photo-cakes", photo: P.blushCake },
  { name: "Eggless Cakes", slug: "eggless", photo: P.redVelvet },
  { name: "Seasonal", slug: "seasonal", photo: P.berryCake },
  { name: "Pastries", slug: "pastries", photo: P.pastries },
  { name: "Anniversary", slug: "anniversary", photo: P.stackCake },
  { name: "Premium", slug: "premium", photo: P.tiramisu },
  { name: "Chocolate", slug: "chocolate", photo: P.chocolateCake },
  { name: "Classic", slug: "classic", photo: P.brownieCake },
  { name: "Engagement Cake", slug: "engagement-cakes", photo: P.dessertPlate },
];

const CONTENT = {
  // The mosaic: one wide card and seven small, all real categories.
  "promo-collage-mosaic": {
    cards: JSON.stringify([
      { image: img(P.decoratedCake, 900, 500), title: "Birthday Cakes", subtitle: "", ctaLabel: "Shop now", href: col("birthday"), wide: "true" },
      ...CATEGORIES.slice(1, 8).map((c) => ({
        image: img(c.photo, 600, 600),
        title: c.name,
        subtitle: "",
        ctaLabel: "Shop now",
        href: col(c.slug),
        wide: "false",
      })),
    ]),
  },

  // The two-panel split: two categories, both full width.
  "promo-collage-split": {
    cards: JSON.stringify([
      { image: img(P.cupcakes, 900, 500), title: "Pastries", subtitle: "", ctaLabel: "Shop now", href: col("pastries"), wide: "true" },
      { image: img(P.weddingCake, 900, 500), title: "Wedding Cakes", subtitle: "", ctaLabel: "Shop now", href: col("wedding"), wide: "true" },
    ]),
  },

  // The browse grid: every category the shop has.
  "tile-grid-gifts": {
    columns: 4,
    tiles: JSON.stringify(
      CATEGORIES.map((c) => ({ image: img(c.photo, 500, 500), label: c.name, href: col(c.slug) })),
    ),
  },

  /*
    The trust strip. Each row is backed by something real:
    eggless and photo cakes are product flags this shop sets on 6 and 5 of its
    products, the city is the one in its own store locator, and custom work is
    what its variant groups offer. No counts, no superlatives, nothing invented.
  */
  "why-us-12": {
    items: JSON.stringify([
      { icon: "Palette", title: "Custom designs", description: "Tell us what you have in mind" },
      { icon: "Leaf", title: "Eggless options", description: "On many of our cakes" },
      { icon: "Award", title: "Photo cakes", description: "Upload your own picture" },
      { icon: "Truck", title: "Delivery in Kota", description: "Across the city" },
    ]),
  },

  // PLACEHOLDER PROSE. Generic on purpose, and the first thing to replace.
  "seo-prose-about": {
    title: "About our cakes",
    blocks: JSON.stringify([
      {
        heading: "Cakes for every occasion",
        body: "Replace this with your own words. This block is where you tell customers what you bake, what you are known for, and what makes an order from you different. Write as much or as little as you like — the first paragraph shows, and the rest opens behind Read more.",
      },
      {
        heading: "How ordering works",
        body: "Replace this too. A short paragraph about choosing a size and flavour, adding a message or a photo, and picking a delivery day usually answers most of what a first-time customer wants to know.",
      },
      {
        heading: "Delivery",
        body: "And this. Say where you deliver, how much notice you need, and what happens if something is wrong with an order.",
      },
    ]),
  },

  // PLACEHOLDER ARTICLES. No links, so nothing here goes anywhere yet.
  "blog-cards-latest": {
    title: "From our kitchen",
    posts: JSON.stringify([
      { image: img(P.cookies, 800, 450), title: "Choosing a cake size", excerpt: "Placeholder article. Replace with your own writing — a short guide to how many people each size serves.", meta: "Guide", href: "" },
      { image: img(P.cupcakes, 800, 450), title: "Flavours we bake", excerpt: "Placeholder article. Replace with your own writing — what you offer, and which ones go fastest.", meta: "Guide", href: "" },
      { image: img(P.tiramisu, 800, 450), title: "Ordering for an event", excerpt: "Placeholder article. Replace with your own writing — how much notice you need for a larger order.", meta: "Guide", href: "" },
    ]),
  },
};

const EMPTY = {
  "promo-collage-mosaic": { cards: "[]" },
  "promo-collage-split": { cards: "[]" },
  "tile-grid-gifts": { tiles: "[]" },
  "why-us-12": { items: "[]" },
  "seo-prose-about": { title: "", blocks: "[]" },
  "blog-cards-latest": { title: "", posts: "[]" },
};

const PATCH = CLEAR ? EMPTY : CONTENT;

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(CLEAR ? "=== MODE: clear ===" : "=== MODE: fill ===");
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

const store = await stores.findOne({ _id: "homepage-sections" });
const version = store?.data?.version;
if (typeof version !== "number") {
  console.log("no version on the homepage store — refusing to write");
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`version: ${version}`);

const missing = Object.keys(PATCH).filter(
  (id) => !(store.data?.published?.sections ?? []).some((s) => s.instanceId === id),
);
if (missing.length) {
  console.log(`no such section: ${missing.join(", ")} — refusing to write`);
  await mongoose.disconnect();
  process.exit(1);
}

function rebuild(which) {
  const sections = store.data?.[which]?.sections ?? [];
  const ledger = [];
  const out = sections.map((s) => {
    const patch = PATCH[s.instanceId];
    if (!patch) return s;
    const content = { ...(s.content ?? {}), ...patch };
    const sizes = Object.entries(patch).map(([k, v]) => {
      if (typeof v !== "string" || !v.startsWith("[")) return `${k}=${JSON.stringify(v)}`;
      let n = 0;
      try {
        n = JSON.parse(v).length;
      } catch {
        n = -1;
      }
      return `${k}=${n} row(s)`;
    });
    ledger.push(`${(s.type ?? "").padEnd(14)} ${s.instanceId.padEnd(22)} ${sizes.join(", ")}`);
    return { ...s, content };
  });
  return { sections: out, ledger };
}

const draft = rebuild("draft");
const published = rebuild("published");
for (const line of published.ledger) console.log("  " + line);

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
