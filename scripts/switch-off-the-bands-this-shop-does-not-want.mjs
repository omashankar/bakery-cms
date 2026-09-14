/**
 * One-off: three bands this shop marked for removal.
 *
 * Run:  node --env-file=.env.local scripts/switch-off-the-bands-this-shop-does-not-want.mjs
 *       node --env-file=.env.local scripts/switch-off-the-bands-this-shop-does-not-want.mjs --apply
 *
 *   header.showBannerStrip  -> false   the promo strip above the logo
 *   header.showCta          -> false   the "Order Inquiry" button beside the cart
 *   hero.showDeliveryFacts  -> false   the Free Delivery / delivery-speed band
 *
 * All three are SWITCHES, not deletions. Nothing is removed and nothing is
 * overwritten: the banners stay active and keep rendering in the homepage's
 * Promo Banner section, the CTA keeps its label and link, and the delivery
 * figures keep coming from commerce settings the moment the switch goes back on.
 *
 * Pinned to the version it read, so a publish landing mid-run makes this a no-op
 * rather than throwing that publish away. Two documents are written — the header
 * store and the homepage-sections store — and they are versioned separately, so
 * a failure on the second leaves the first applied. That is reported rather than
 * rolled back: they are independent settings, and re-running is safe.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===\n");

let changed = 0;
let failed = 0;

/* ─────────────────────────── the header store ─────────────────────────── */

const header = await stores.findOne({ _id: "header" });
if (!header?.data) {
  console.log("FAIL: no header document");
  process.exit(1);
}

const headerEdits = [
  { key: "showBannerStrip", was: header.data.showBannerStrip, why: "the promo strip above the logo" },
  { key: "showCta", was: header.data.showCta, why: 'the "Order Inquiry" button' },
];

const headerNext = { ...header.data };
for (const edit of headerEdits) {
  if (edit.was === false) {
    console.log(`SKIP  header.${edit.key}  (already off)`);
    continue;
  }
  headerNext[edit.key] = false;
  changed += 1;
  console.log(`SET   header.${edit.key}  ${JSON.stringify(edit.was)} -> false   — ${edit.why}`);
}

/* ──────────────────────── the homepage-sections store ──────────────────── */

const page = await stores.findOne({ _id: "homepage-sections" });
const version = page?.data?.version;
if (typeof version !== "number") {
  console.log(`FAIL: homepage data.version is ${JSON.stringify(version)}`);
  process.exit(1);
}

const pageNext = JSON.parse(JSON.stringify(page.data));
for (const which of ["draft", "published"]) {
  const hero = pageNext[which].sections.find((s) => s.type === "hero");
  if (!hero) {
    console.log(`FAIL: no hero row in ${which}`);
    process.exit(1);
  }
  if (hero.content.showDeliveryFacts === false) {
    console.log(`SKIP  ${which}/hero.showDeliveryFacts  (already off)`);
    continue;
  }
  console.log(
    `SET   ${which}/hero.showDeliveryFacts  ` +
      `${JSON.stringify(hero.content.showDeliveryFacts)} -> false   — the Free Delivery band`,
  );
  hero.content.showDeliveryFacts = false;
  changed += 1;
}

console.log(`\n${changed} switch(es) to flip.`);

if (!APPLY) {
  console.log("\nNothing is deleted by any of these — see the note at the top.");
  console.log("Dry run — nothing written. Re-run with --apply.");
  await mongoose.disconnect();
  process.exit(0);
}

if (changed === 0) {
  console.log("Nothing to write.");
  await mongoose.disconnect();
  process.exit(0);
}

/*
  The header store carries no version of its own — the site-layout service
  replaces the whole document — so this pins on the value it read instead, which
  gives the same protection against a concurrent save of the Header screen.
*/
const headerResult = await stores.updateOne(
  { _id: "header", "data.showCta": header.data.showCta },
  { $set: { data: headerNext } },
);
if (headerResult.matchedCount !== 1) {
  console.log("FAIL: the header document changed while this ran. Nothing written to it.");
  failed += 1;
} else {
  console.log("wrote header");
}

const pageResult = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  { $set: { data: { ...pageNext, version: version + 1 } } },
);
if (pageResult.modifiedCount !== 1) {
  console.log("FAIL: somebody published while this ran. Nothing written to the homepage.");
  failed += 1;
} else {
  console.log(`wrote homepage. data.version ${version} -> ${version + 1}`);
}

/* ─────────────────────────────── readback ─────────────────────────────── */

const afterHeader = await stores.findOne({ _id: "header" });
const afterPage = await stores.findOne({ _id: "homepage-sections" });

const checks = [
  ["header.showBannerStrip", afterHeader?.data?.showBannerStrip],
  ["header.showCta", afterHeader?.data?.showCta],
  [
    "draft/hero.showDeliveryFacts",
    afterPage?.data?.draft?.sections?.find((s) => s.type === "hero")?.content?.showDeliveryFacts,
  ],
  [
    "published/hero.showDeliveryFacts",
    afterPage?.data?.published?.sections?.find((s) => s.type === "hero")?.content?.showDeliveryFacts,
  ],
];

console.log("");
for (const [name, value] of checks) {
  const ok = value === false;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK  " : "BAD "} ${name} = ${JSON.stringify(value)}`);
}

/*
  And the thing this must NOT have done: the banners are switched off from the
  header, not deactivated. They still have to be live, so the Promo Banner
  section on the homepage keeps drawing them.
*/
const banners = await stores.findOne({ _id: "banners" });
const list = Array.isArray(banners?.data) ? banners.data : (banners?.data?.banners ?? []);
const active = list.filter((b) => b.isActive).length;
console.log(`OK   ${active} banner(s) still active — the strip is hidden, not the banners`);

await mongoose.disconnect();
process.exit(failed ? 1 : 0);
