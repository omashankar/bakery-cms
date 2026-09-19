/**
 * THE SEO ROW FOR A PAGE THAT IS GONE.
 *
 *   node --env-file=.env.local scripts/the-seo-row-for-a-page-that-is-gone.mjs
 *   …add --apply to write.
 *
 * Removing the `store-search` seed from the code does NOT remove what a
 * running shop already stored: neither the server nor the browser merges the
 * seed into a stored routes array. So Admin → SEO keeps listing "Search",
 * pointing at /store/search, which now redirects — an owner editing that row
 * would be writing a title for a page nobody can reach.
 *
 * It refuses to run if the route still exists in the app.
 */
import mongoose from "mongoose";
import { existsSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const GONE = "/store/search";

if (existsSync("app/(storefront)/store/search/page.tsx")) {
  console.log("the search page still exists — refusing to remove its SEO row");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log("db: " + db.databaseName);
console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");
console.log("");

const doc = await stores.findOne({ _id: "seo" });
const routes = doc?.data?.routes;
if (!Array.isArray(routes)) {
  console.log("  the seo document holds no routes array — nothing to do");
  await mongoose.disconnect();
  process.exit(0);
}

const doomed = routes.filter((row) => String(row?.path ?? "") === GONE);
const kept = routes.filter((row) => String(row?.path ?? "") !== GONE);

console.log("  " + routes.length + " rows stored, " + doomed.length + " pointing at " + GONE + ":");
for (const row of doomed) {
  console.log("    " + String(row.id).padEnd(20) + String(row.label ?? row.title ?? "").padEnd(14) + row.path);
}
if (doomed.length === 0) {
  console.log("  nothing to remove");
  await mongoose.disconnect();
  process.exit(0);
}

if (!APPLY) {
  console.log("");
  console.log("  DRY RUN — nothing written.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne({ _id: "seo" }, { $set: { "data.routes": kept } });
console.log("");
console.log("  matched " + result.matchedCount + ", modified " + result.modifiedCount + ", " + kept.length + " rows left");
await mongoose.disconnect();
