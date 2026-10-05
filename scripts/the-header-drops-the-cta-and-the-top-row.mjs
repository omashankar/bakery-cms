/**
 * One-off data cleanup: the five keys the header no longer has.
 *
 * Run:  node --env-file=.env.local scripts/the-header-drops-the-cta-and-the-top-row.mjs
 *       node --env-file=.env.local scripts/the-header-drops-the-cta-and-the-top-row.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints the whole stored document first, so
 * a person can see what is there before anything is unset.
 *
 * Why this exists
 * ---------------
 * The shop asked for the header's CTA button and the thin row above the logo
 * to go. Both were LIVE when they went — an "Order Inquiry" button beside the
 * cart, and a row reading "Currency · INR". The code no longer reads
 * `showCta`, `ctaLabel`, `ctaHref`, `utilityNav` or `showCurrencyNote`, and
 * `headerSchema` now drops all five on the way in, so the next Header save
 * cleans the document by itself.
 *
 * This is for the shop that does not save its header for a year. A field the
 * code has dropped and the database still holds is a thing somebody finds
 * later and cannot explain — and worse, a backup taken today would carry them
 * forward into a restore.
 *
 * THE PROMO STRIP STAYS. `showBannerStrip` is NOT touched: the shop kept it,
 * because the published homepage has no Promo Banner section and the Banner
 * Grid section draws its own separate list, so the strip is the only place the
 * Banners screen reaches a customer.
 *
 * It is the smallest possible write:
 *
 *   - `$unset` on five named keys of ONE document, `cmsstores._id: "header"`.
 *     Nothing else in that document is read, rewritten or reordered — no
 *     `$set`, so `nav`, `logoLetter`, `searchPlaceholder`, `showSearch` and
 *     `showBannerStrip` cannot be touched even by accident.
 *   - A key that is already absent is left alone and reported as such.
 *   - The snapshot is written to a file before the write, so the exact prior
 *     document can be put back by hand.
 *
 * Safe to run twice: the second run finds nothing left to do.
 */
import { writeFileSync } from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** The five, and only the five. */
const DROPPED = ["showCta", "ctaLabel", "ctaHref", "utilityNav", "showCurrencyNote"];
/** Named so a reader can see it is deliberately absent from the list above. */
const KEPT_ON_PURPOSE = "showBannerStrip";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

await mongoose.connect(uri);
const stores = mongoose.connection.db.collection("cmsstores");

const before = await stores.findOne({ _id: "header" });
if (!before) {
  console.log("no header document stored — nothing to clean.");
  await mongoose.disconnect();
  process.exit(0);
}

const data = before.data ?? {};

console.log("=== THE STORED HEADER, AS IT IS NOW ===");
for (const [key, value] of Object.entries(data)) {
  const summary = Array.isArray(value) ? `array(${value.length})` : JSON.stringify(value);
  const mark = DROPPED.includes(key) ? "DROP" : "keep";
  console.log(`  ${mark}  ${key}: ${String(summary).slice(0, 80)}`);
}

const present = DROPPED.filter((key) => key in data);
const absent = DROPPED.filter((key) => !(key in data));

console.log("\n=== WHAT THIS WOULD UNSET ===");
if (present.length === 0) console.log("  (nothing — already clean)");
for (const key of present) console.log(`  data.${key} = ${JSON.stringify(data[key])}`);
if (absent.length > 0) console.log(`  already absent: ${absent.join(", ")}`);

console.log(
  `\n=== KEPT ON PURPOSE ===\n  data.${KEPT_ON_PURPOSE} = ${JSON.stringify(data[KEPT_ON_PURPOSE])}` +
    "\n  The promo strip stays — it is the only place this shop's banners appear.",
);

if (!APPLY) {
  console.log("\nDRY RUN. Pass --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

if (present.length === 0) {
  console.log("\nnothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

/* The exact prior document, on disk, before anything is written. */
const snapshotAt = `header-before-cta-and-top-row-removal.json`;
writeFileSync(snapshotAt, JSON.stringify(before, null, 2));
console.log(`\nsnapshot written to ${snapshotAt}`);

const unset = Object.fromEntries(present.map((key) => [`data.${key}`, ""]));
const result = await stores.updateOne({ _id: "header" }, { $unset: unset });
console.log(`matched ${result.matchedCount}, modified ${result.modifiedCount}`);

const after = await stores.findOne({ _id: "header" });
const left = DROPPED.filter((key) => key in (after?.data ?? {}));
console.log("keys remaining of the five:", left.length === 0 ? "none" : left.join(", "));
console.log(
  `${KEPT_ON_PURPOSE} is still`,
  JSON.stringify((after?.data ?? {})[KEPT_ON_PURPOSE]),
);
console.log("nav rows still stored:", (after?.data?.nav ?? []).length);

await mongoose.disconnect();
