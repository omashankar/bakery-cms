/**
 * One-off: the live homepage still says things nobody at this shop wrote.
 *
 * Run:  node --env-file=.env.local scripts/take-the-shipped-claims-off-the-demo-homepage.mjs
 *       node --env-file=.env.local scripts/take-the-shipped-claims-off-the-demo-homepage.mjs --apply
 *       …add --banner to switch the hero to the full-bleed layout at the same time.
 *
 * The section REGISTRY was cleaned of its shipped claims, but a registry default
 * only reaches a section created after the deploy. Every row on this shop's
 * homepage was created from the old one and still carries its copy, in `draft`
 * and in `published`:
 *
 *   "Every bit as delicious — crafted without eggs for all celebrations"
 *       — a guarantee about FOOD, made by the software, over a row that shows
 *         whatever the shop has filed under Eggless
 *   "The cakes everyone is talking about this season"
 *   "Our most loved cakes, made fresh to order"
 *   "Turn your favourite memories into delicious edible art"
 *   "Limited-edition flavours inspired by the season's finest ingredients"
 *   "Bespoke wedding cakes designed to make your special day unforgettable"
 *   "Subscribe for exclusive offers, new cake launches, and seasonal specials…"
 *       — five claims and a promise, none of them the shop's
 *   "The Sweet Crumbs Difference"
 *       — the DEMO BRAND'S NAME, on a bakery in Kota, in the overline of its
 *         Why Choose Us band
 *
 * WHAT THIS DOES NOT TOUCH, and the list is the point:
 *
 *   promo-banner-2  "Welcome offer / 150 off your order / Use code WELCOME150"
 *   store-locator   "One shop, in Kota. Come and say hello."
 *   gallery         "Some of what has come out of our kitchen."
 *   cta             the phone number
 *
 * Those are the shop's own words about the shop's own offer, and telling them
 * apart from the seeded ones is the whole job here. Every row is addressed by
 * `instanceId`, and every change REFUSES unless the value on disk is still the
 * seeded one — so an edit made in the builder since is never overwritten.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const BANNER = process.argv.includes("--banner");

/**
 * Each entry: the row, the key, the value that must currently be there, and
 * what to put instead.
 *
 * `expect` is not belt and braces. This runs against a live shop whose owner
 * can edit any of these in the builder at any time, and a blind write would
 * silently replace a sentence somebody had just typed. A mismatch is reported
 * and skipped, not forced.
 */
const EDITS = [
  {
    id: "our-menu-1",
    key: "description",
    expect: "Shop by category — cakes, pastries, chocolates, and more.",
    to: "",
    why: "lists a bakery's goods over tiles built from this shop's own categories",
  },
  {
    id: "our-menu-1",
    key: "title",
    expect: "Our Menu",
    to: "Shop by category",
    why: "says what the band does, in words true of any catalogue",
  },
  {
    id: "categories-3",
    key: "description",
    expect:
      "Find the perfect cake for every celebration — birthdays, weddings, anniversaries, and more.",
    to: "",
    why: "calls the goods perfect, and names a trade",
  },
  {
    id: "featured-cakes-4",
    key: "title",
    expect: "Featured Cakes",
    to: "Featured",
    why: "names a trade in a heading over the shop's own picks",
  },
  {
    id: "featured-cakes-4",
    key: "description",
    expect: "Our most loved cakes, made fresh to order.",
    to: "",
    why: "a claim about how loved they are, and about freshness",
  },
  {
    id: "trending-5",
    key: "description",
    expect: "The cakes everyone is talking about this season.",
    to: "",
    why: "a claim about what everyone is talking about",
  },
  {
    id: "wedding-8",
    key: "description",
    expect: "Bespoke wedding cakes designed to make your special day unforgettable.",
    to: "",
    why: "promises the day will be unforgettable",
  },
  {
    id: "photo-cakes-9",
    key: "description",
    expect: "Turn your favourite memories into delicious edible art.",
    to: "",
    why: "a claim about taste",
  },
  {
    id: "eggless-10",
    key: "overline",
    expect: "100% Eggless",
    to: "",
    why: "a guarantee about food, over a row that shows whatever is filed under Eggless",
  },
  {
    id: "eggless-10",
    key: "description",
    expect: "Every bit as delicious — crafted without eggs for all celebrations.",
    to: "",
    why: "the same guarantee, spelled out",
  },
  {
    id: "seasonal-11",
    key: "description",
    expect: "Limited-edition flavours inspired by the season's finest ingredients.",
    to: "",
    why: "claims the ingredients are the season's finest",
  },
  {
    id: "why-us-12",
    key: "overline",
    expect: "The Sweet Crumbs Difference",
    to: "",
    why: "THE DEMO BRAND'S NAME, on this shop's own homepage",
  },
  {
    id: "newsletter-17",
    key: "description",
    expect:
      "Subscribe for exclusive offers, new cake launches, and seasonal specials delivered to your inbox.",
    to: "",
    why: "promises three things nobody agreed to send",
  },
  {
    id: "cta-18",
    key: "title",
    expect: "Ready to Order Your Perfect Cake?",
    to: "Ready to order?",
    why: "calls the goods perfect, and names a trade",
  },
  {
    id: "cta-18",
    key: "description",
    expect:
      "Whether it's a birthday surprise, wedding centerpiece, or corporate celebration — our team is here to help.",
    to: "",
    why: "promises a team",
  },
  {
    id: "store-locator-16",
    key: "buttonLabel",
    expect: "Find Stores",
    to: "Get directions",
    why: "plural, on a shop whose own line beside it reads 'One shop, in Kota'",
  },
];

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");

const stores = db.collection("cmsstores");
const doc = await stores.findOne({ _id: "homepage-sections" });
if (!doc?.data?.published?.sections || !doc?.data?.draft?.sections) {
  console.log("FAIL: no usable homepage-sections document");
  process.exit(1);
}

const version = doc.data.version;
if (typeof version !== "number") {
  console.log(`FAIL: data.version is ${JSON.stringify(version)}, not a number`);
  process.exit(1);
}
console.log(`data.version = ${version}  (the write below is pinned to it)\n`);

/**
 * Applied to draft AND published, separately.
 *
 * The two snapshots are independent copies. Writing only `published` leaves the
 * builder showing the old sentences, and the owner's next Publish puts every one
 * of them straight back.
 */
const next = JSON.parse(JSON.stringify(doc.data));
let changed = 0;
let skipped = 0;

for (const edit of EDITS) {
  for (const which of ["draft", "published"]) {
    const row = next[which].sections.find((s) => s.instanceId === edit.id);
    if (!row) {
      console.log(`MISS  ${which}/${edit.id}  (row not found)`);
      skipped += 1;
      continue;
    }
    const current = row.content?.[edit.key];
    if (current === edit.to) {
      console.log(`SKIP  ${which}/${edit.id}.${edit.key}  (already)`);
      continue;
    }
    if (current !== edit.expect) {
      console.log(
        `SKIP  ${which}/${edit.id}.${edit.key}  (edited since — on disk: ${JSON.stringify(
          String(current ?? "").slice(0, 60),
        )})`,
      );
      skipped += 1;
      continue;
    }
    row.content[edit.key] = edit.to;
    changed += 1;
    console.log(`SET   ${which}/${edit.id}.${edit.key}`);
    console.log(`        was: ${JSON.stringify(edit.expect)}`);
    console.log(`        now: ${JSON.stringify(edit.to)}`);
    console.log(`        why: ${edit.why}`);
  }
}

if (BANNER) {
  console.log("\n--- --banner: the hero layout ---");
  for (const which of ["draft", "published"]) {
    const hero = next[which].sections.find((s) => s.type === "hero");
    if (!hero) {
      console.log(`MISS  ${which}: no hero row`);
      continue;
    }
    if (hero.content.layout === "banner") {
      console.log(`SKIP  ${which}/hero  (already banner)`);
      continue;
    }
    hero.content.layout = "banner";
    changed += 1;
    console.log(`SET   ${which}/hero.layout = "banner"`);
  }
  /*
    A warning, not a refusal: it is the owner's homepage. The slides stored on
    this shop are 529x397 — portrait-ish and small — and a banner is drawn at
    3:1 across the whole window, so `object-cover` will keep a strip through the
    middle of each and scale it up about 3.6x. Wide artwork first, then this.
  */
  console.log(
    "\n  NOTE: a banner is drawn 3:1 across the window. Check each slide's image is\n" +
      "  wide (about 1920x640) before publishing, or it will be cropped and soft.",
  );
}

console.log(`\n${changed} value(s) to change, ${skipped} skipped.`);

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply.");
  await mongoose.disconnect();
  process.exit(0);
}

if (changed === 0) {
  console.log("Nothing to write.");
  await mongoose.disconnect();
  process.exit(0);
}

next.version = version + 1;
next.draft.updatedAt = new Date().toISOString();
next.published.updatedAt = next.draft.updatedAt;

/**
 * Pinned to the version we read.
 *
 * The builder writes this same document through `nextVersion`, and a publish
 * that landed while this script was running would be silently thrown away by an
 * unpinned write. The filter makes that a no-op instead, and the readback below
 * says so.
 */
const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  { $set: { data: next } },
);

if (result.modifiedCount !== 1) {
  console.log(
    `FAIL: wrote ${result.modifiedCount} document(s). ` +
      "Somebody published while this ran — nothing was changed. Re-run it.",
  );
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
let wrong = 0;
for (const edit of EDITS) {
  for (const which of ["draft", "published"]) {
    const row = after.data[which].sections.find((s) => s.instanceId === edit.id);
    const value = row?.content?.[edit.key];
    // Either it is the new value, or it was skipped because somebody had edited
    // it — anything else means the write did not land the way it was printed.
    if (value !== edit.to && value !== edit.expect) {
      console.log(`READBACK MISMATCH  ${which}/${edit.id}.${edit.key} = ${JSON.stringify(value)}`);
      wrong += 1;
    }
  }
}

console.log(
  `\nwrote. data.version ${version} -> ${after.data.version}. ` +
    `readback mismatches: ${wrong}`,
);
await mongoose.disconnect();
process.exit(wrong ? 1 : 0);
