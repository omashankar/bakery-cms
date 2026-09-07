/**
 * One-off: the shop delivers same-day, so its zones must say so too.
 *
 * Run:  node --env-file=.env.local scripts/set-zones-same-day.mjs
 *       node --env-file=.env.local scripts/set-zones-same-day.mjs --apply
 *
 * `commerce.deliveryLeadDays` alone does not open same-day delivery. Both the
 * checkout's date floor and `placeOrder`'s server-side refusal take the
 * STRICTER of the two lead times:
 *
 *     leadDays = Math.max(zone.minDeliveryDays, commerce.deliveryLeadDays)
 *
 * — so a shop set to 0 still refused today everywhere its zones said 1. These
 * five zones carry the seeded demo values (identical timestamps, never edited
 * in the admin), and only Mumbai Central shipped with 0.
 *
 * The inactive zone is left alone: it delivers nothing, so it promises nothing.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const MIN_DAYS = 0;

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const zones = mongoose.connection.db.collection("deliveryzones");

const now = new Date().toISOString();
let written = 0;

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");

for (const zone of await zones.find({}).sort({ priority: -1 }).toArray()) {
  const label = `${zone.name.padEnd(16)} min=${zone.minDeliveryDays}`;

  if (!zone.isActive) {
    console.log(`SKIP  ${label}  (inactive)`);
    continue;
  }
  if (zone.minDeliveryDays === MIN_DAYS) {
    console.log(`SKIP  ${label}  (already same-day)`);
    continue;
  }

  console.log(`SET   ${label} -> ${MIN_DAYS}`);
  if (APPLY) {
    const result = await zones.updateOne(
      { _id: zone._id },
      { $set: { minDeliveryDays: MIN_DAYS, updatedAt: now } },
    );
    console.log(`      matched=${result.matchedCount} modified=${result.modifiedCount}`);
    written += result.modifiedCount;
  }
}

console.log(`\n${APPLY ? `${written} zones written` : "nothing written"}`);
await mongoose.disconnect();
