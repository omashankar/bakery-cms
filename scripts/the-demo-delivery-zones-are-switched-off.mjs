/**
 * THE SHIPPED DEMO ZONES STOP QUOTING FOR A SHOP THAT IS NOT IN MUMBAI.
 *
 *   node --env-file=.env.local scripts/the-demo-delivery-zones-are-switched-off.mjs
 *   …add --apply to write.
 *
 * This shop's Delivery Zones are the ones the software ships with: Mumbai
 * Central, Mumbai Suburbs, Pune City, Thane. The shop is in Kota. Until now
 * that was mostly invisible — the zone list only decided a delivery charge, and
 * an unmatched address fell back to the flat fee either way.
 *
 * It stopped being invisible when the product page gained a PIN-code check. A
 * customer in Kota now types 324001 into a box on every product and is told, in
 * red, that the shop has not covered it — which is a sentence about a list of
 * neighbourhoods a thousand kilometres away.
 *
 * SWITCHED OFF, NOT DELETED, at the owner's choice. The records stay, so a shop
 * that does one day deliver in Mumbai can switch them back on rather than
 * retyping four zones and their charges.
 *
 * WHAT THE STOREFRONT DOES WITH NO ACTIVE ZONE, which is the state this leaves
 * it in until the owner adds their own: `getPublicZones` filters on `isActive`,
 * so the public endpoint returns an empty list and `PincodeCheck` renders
 * nothing at all. No box, no red cross, no claim about coverage. Delivery falls
 * back to the flat fee and the free-delivery threshold, exactly as it does today
 * for every address that matches no zone. That is a working shop, not a broken
 * one — and it is quieter than a checker that can only ever say no.
 *
 * NOTHING IS INVENTED HERE. The owner's own zones — where they deliver, where
 * it is free, where it costs — are theirs to enter, and the admin already has a
 * field for each. This script only stops the shipped examples from answering on
 * their behalf.
 */
import mongoose from "mongoose";
import { mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const zones = db.collection("deliveryzones");

console.log("db: " + db.databaseName);
console.log(APPLY ? "MODE: apply" : "MODE: dry run — nothing will be written");
console.log("");

const all = await zones.find({}).toArray();
const active = all.filter((zone) => zone.isActive);

console.log("every zone on record:");
for (const zone of all) {
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

if (active.length === 0) {
  console.log("No active zone to switch off. Nothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

/*
  THE SNAPSHOT IS THE WHOLE RECORD, not just the flag. Switching a zone off is
  reversible by hand, but only if what it said is still written down somewhere
  — and this is the only copy of four charges and four delivery windows.
*/
mkdirSync("scripts/.snapshots", { recursive: true });
const path = "scripts/.snapshots/delivery-zones-before-switch-off.json";
writeFileSync(path, JSON.stringify(all, null, 2));
console.log("snapshot written: " + path);
console.log("");

for (const zone of active) {
  if (!APPLY) {
    console.log("  would switch off: " + zone.name);
    continue;
  }

  /*
    Pinned on `isActive: true`. If somebody switched this zone off — or on and
    off — between the read above and this write, the filter matches nothing and
    the script says so, rather than writing over a decision it did not see.
  */
  const result = await zones.updateOne(
    { _id: zone._id, isActive: true },
    { $set: { isActive: false, updatedAt: new Date() } },
  );

  console.log(
    result.matchedCount === 1
      ? "  switched off: " + zone.name
      : "  NOT WRITTEN (it changed since it was read): " + zone.name,
  );
}

console.log("");
if (APPLY) {
  const left = (await zones.find({ isActive: true }).toArray()).length;
  console.log("active zones now: " + left);
  console.log(
    left === 0
      ? "The PIN-code row will not render until the owner adds a zone of their own."
      : "Some zones are still active.",
  );
} else {
  console.log("Dry run only. Re-run with --apply to write.");
}

await mongoose.disconnect();
