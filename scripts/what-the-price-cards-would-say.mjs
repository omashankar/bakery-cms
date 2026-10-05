/**
 * READ ONLY. What a "category cards with prices" row would actually show.
 *
 *   node --env-file=.env.local scripts/what-the-price-cards-would-say.mjs
 *
 * The price on those cards is NOT a field — it is the cheapest product in the
 * category, read at render time. So before adding the band it is worth knowing
 * which categories have anything in them: one that does not shows a name and no
 * price, which is correct but reads as unfinished.
 */
import mongoose from "mongoose";

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
console.log(`db: ${db.databaseName}\n`);

const catalog = await db.collection("catalogs").findOne({});
const categories = catalog?.categories ?? [];
const products = await db.collection("products").find({}).toArray();

const rows = categories.map((c) => {
  const id = String(c.id);
  const mine = products.filter(
    (p) =>
      (p.categoryIds ?? []).map(String).includes(id) || String(p.categoryId ?? "") === id,
  );
  const live = mine.filter((p) => (p.status ?? "published") === "published");
  const prices = live.map((p) => Number(p.price)).filter((n) => Number.isFinite(n) && n > 0);
  return {
    name: c.name,
    slug: c.slug,
    image: c.image ? "yes" : "NO",
    products: live.length,
    from: prices.length ? Math.min(...prices) : null,
  };
});

rows.sort((a, b) => b.products - a.products);
const w = Math.max(...rows.map((r) => r.name.length), 8);
console.log("  " + "CATEGORY".padEnd(w) + "  " + "SLUG".padEnd(16) + "LIVE".padStart(5) + "  CHEAPEST  OWN IMAGE");
for (const r of rows) {
  console.log(
    "  " + r.name.padEnd(w) + "  " + r.slug.padEnd(16) +
      String(r.products).padStart(5) + "  " +
      (r.from === null ? "       — " : ("Rs " + r.from).padStart(9)) + "  " + r.image,
  );
}
console.log(
  `\n  ${rows.filter((r) => r.from !== null).length} of ${rows.length} categories would show a price.`,
);
await mongoose.disconnect();
