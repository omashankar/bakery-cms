/**
 * KOTA, WHICH IS WHERE THIS SHOP IS.
 *
 *   node --env-file=.env.local scripts/the-shop-says-where-it-actually-delivers.mjs
 *   …add --apply to write.
 *
 * The four shipped zones were switched off because they described Mumbai. This
 * puts one back that describes the shop.
 *
 * ONE RULE, `324`, AND NOT A LIST OF NEIGHBOURHOODS. Under six digits a zone's
 * pincode is a PREFIX, so `324` matches every code beginning 324 — which is
 * Kota. Splitting it into Dadabari, Talwandi, Vigyan Nagar and the rest would
 * mean writing down which pincode each of those is, and a wrong digit there is
 * not a cosmetic error: it is a real customer being told the shop cannot reach
 * them, or being quoted the wrong fee, at the moment they were about to buy.
 * The owner knows those boundaries and the admin takes one zone per area, each
 * with its own charge, whenever they want to draw them.
 *
 * THE CHARGE IS ₹99 BECAUSE THAT IS WHAT KOTA ALREADY PAYS. Nothing here is a
 * new price. With no zone matching, `calculateDeliveryQuote` falls back to the
 * shop's flat `deliveryFee`, which is 99, and to `freeDeliveryThreshold`, which
 * is 999 — so a Kota order of ₹400 is charged ₹99 today and is charged ₹99
 * after this, and one of ₹1,200 is free before and after. The ONLY thing that
 * changes is that the PIN-code box can now answer "yes" instead of rendering
 * nothing.
 *
 * That was deliberate. The owner was asked what Kota should cost and answered
 * that it is theirs to decide, per area — so this script picks the one number
 * that decides nothing, and the admin's Delivery charge field is where the
 * decision goes when they make it.
 *
 * SAME-DAY, which the owner did choose: `minDeliveryDays: 0` makes the product
 * page read "Same-day delivery", governed by the shop's existing same-day
 * cutoff time.
 */
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const ZONE = {
  id: "zone-kota",
  name: "Kota",
  city: "Kota",
  /* Under six digits is a prefix: every pincode starting 324. */
  pincode: "324",
  /* Read by nothing — kept only because the stored shape still carries it. */
  radiusKm: 0,
  /* Today's flat fee, so no customer's bill moves. See the docblock. */
  deliveryCharge: 99,
  minDeliveryDays: 0,
  estimatedDeliveryDays: 1,
  isActive: true,
  /*
    Above the switched-off Mumbai rules, so that if any of them is ever turned
    back on, a six-digit Mumbai zone still wins on its own pincode while this
    one keeps Kota. Specificity is the first sort key; priority only settles
    rules of equal precision.
  */
  priority: 100,
};

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const zones = db.collection("deliveryzones");

console.log("db: " + db.databaseName);
console.log(APPLY ? "MODE: apply" : "MODE: dry run — nothing will be written");
console.log("");

const before = await zones.find({}).toArray();
console.log("zones on record now:");
for (const zone of before) {
  console.log(
    "  " +
      String(zone.name).padEnd(16) +
      " rule " +
      String(zone.pincode).padEnd(7) +
      " charge " +
      String(zone.deliveryCharge).padStart(4) +
      "   " +
      (zone.isActive ? "ON" : "off"),
  );
}
console.log("");

const clash = before.find((zone) => zone.id === ZONE.id || zone.pincode === ZONE.pincode);
if (clash) {
  console.log(
    "A zone with that id or rule already exists (" +
      clash.name +
      "). Nothing written — edit it in the admin instead of creating a second.",
  );
  await mongoose.disconnect();
  process.exit(0);
}

mkdirSync("scripts/.snapshots", { recursive: true });
const path = "scripts/.snapshots/delivery-zones-before-kota.json";
writeFileSync(path, JSON.stringify(before, null, 2));
console.log("snapshot written: " + path);
console.log("");

console.log("the zone this adds:");
console.log("  name            " + ZONE.name);
console.log("  pincode rule    " + ZONE.pincode + "   (every code starting 324)");
console.log("  delivery charge ₹" + ZONE.deliveryCharge + "   (the flat fee Kota already pays)");
console.log("  minimum days    " + ZONE.minDeliveryDays + "    (same-day)");
console.log("");

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

const now = new Date();
await zones.insertOne({ ...ZONE, createdAt: now, updatedAt: now });

const active = (await zones.find({ isActive: true }).toArray()).map((zone) => zone.name);
console.log("written. active zones now: " + (active.join(", ") || "none"));

await mongoose.disconnect();
