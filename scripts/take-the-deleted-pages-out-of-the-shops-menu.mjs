/**
 * THE MENU STILL POINTED AT THE PAGES THAT WENT.
 *
 *   node --env-file=.env.local scripts/take-the-deleted-pages-out-of-the-shops-menu.mjs
 *   …add --apply to write.
 *
 * About, Gallery and the wedding-cakes page were removed from the code. The
 * shop's MENU is not in the code — it is stored, and it kept its rows. So the
 * live storefront carried seven links to pages that now 404: three in the nav
 * band, three in the footer, and an active hero banner.
 *
 * Four documents, all in `cmsstores`:
 *
 *   header    three nav rows removed
 *   footer    three column links removed
 *   banners   the wedding offer banner REPOINTED, not deleted — "₹499 off
 *             wedding cakes above ₹10,000" is the shop's own live offer and
 *             wedding cakes are still a category, so it goes to the category
 *             page rather than nowhere
 *   seo       three routes removed, so the sitemap stops handing crawlers
 *             three addresses that answer 404
 *
 * NOT TOUCHED, because they are already invisible: `wedding-8` and
 * `gallery-14` still hold a dead ctaHref, and both bands are switched off.
 * Turning either back on would need its link fixed first.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const DEAD = /^\/store\/(about|gallery|wedding-cakes)\b/;
const BANNER_TO = "/store/collections/wedding";

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

const writes = [];

// ── header nav
const header = await stores.findOne({ _id: "header" });
const nav = header?.data?.nav ?? [];
const navKept = nav.filter((item) => !DEAD.test(item.href ?? ""));
console.log(`header nav: ${nav.length} -> ${navKept.length}`);
for (const item of nav) {
  if (DEAD.test(item.href ?? "")) console.log(`  DROP  ${item.label} -> ${item.href}`);
}
if (navKept.length !== nav.length) {
  writes.push({ id: "header", set: { "data.nav": navKept } });
}

// ── footer columns
const footer = await stores.findOne({ _id: "footer" });
const columns = footer?.data?.columns ?? [];
let footerDropped = 0;
const columnsKept = columns.map((column) => {
  const links = column.links ?? [];
  const kept = links.filter((link) => !DEAD.test(link.href ?? ""));
  for (const link of links) {
    if (DEAD.test(link.href ?? "")) {
      console.log(`  DROP  ${column.title} / ${link.label} -> ${link.href}`);
      footerDropped += 1;
    }
  }
  return { ...column, links: kept };
});
console.log(`footer links dropped: ${footerDropped}`);
if (footerDropped) writes.push({ id: "footer", set: { "data.columns": columnsKept } });

// ── the banner, repointed
const banners = await stores.findOne({ _id: "banners" });
const bannerData = banners?.data ?? {};
const bannerSet = {};
for (const [key, banner] of Object.entries(bannerData)) {
  if (!banner || typeof banner !== "object") continue;
  if (!DEAD.test(banner.link ?? "")) continue;
  console.log(
    `  MOVE  banner "${banner.title}" (active=${banner.isActive}) ${banner.link} -> ${BANNER_TO}`,
  );
  bannerSet[`data.${key}.link`] = BANNER_TO;
}
if (Object.keys(bannerSet).length) writes.push({ id: "banners", set: bannerSet });

// ── the SEO route table
const seo = await stores.findOne({ _id: "seo" });
const routes = seo?.data?.routes ?? [];
const routesKept = routes.filter((route) => !DEAD.test(route.path ?? ""));
console.log(`seo routes: ${routes.length} -> ${routesKept.length}`);
for (const route of routes) {
  if (DEAD.test(route.path ?? "")) console.log(`  DROP  ${route.routeKey} ${route.path}`);
}
if (routesKept.length !== routes.length) {
  writes.push({ id: "seo", set: { "data.routes": routesKept } });
}

console.log(`\n${writes.length} document(s) to write: ${writes.map((w) => w.id).join(", ")}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

for (const write of writes) {
  const result = await stores.updateOne({ _id: write.id }, { $set: write.set });
  console.log(`  ${write.id}: matched ${result.matchedCount}, modified ${result.modifiedCount}`);
}

// Readback — the whole point is that nothing still points at a deleted page.
let left = 0;
for (const id of ["header", "footer", "banners", "seo"]) {
  const doc = await stores.findOne({ _id: id });
  const hits = [...JSON.stringify(doc).matchAll(/"\/store\/(?:about|gallery|wedding-cakes)[^"]*"/g)];
  if (hits.length) {
    console.log(`  READBACK ${id} still has ${hits.length}: ${[...new Set(hits.map((h) => h[0]))].join(", ")}`);
    left += hits.length;
  }
}
console.log(left === 0 ? "\nreadback: nothing points at a deleted page" : `\nreadback: ${left} LEFT`);

await mongoose.disconnect();
