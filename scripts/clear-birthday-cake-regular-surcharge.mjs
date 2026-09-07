/**
 * One-off: Birthday Cake listed at 1019 for a product priced 999.
 *
 * Run:  node --env-file=.env.local scripts/clear-birthday-cake-regular-surcharge.mjs
 *       node --env-file=.env.local scripts/clear-birthday-cake-regular-surcharge.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * The "Regular" option in this product's own group carried +20. Regular is the
 * default — it is what the customer gets by asking for nothing — so that 20 was
 * added to the price on the grid card and the product page before anybody
 * touched anything, and the cake advertised 1019 against the 999 its owner had
 * typed into the price field.
 *
 * It also understated the upgrade beside it. `asAddOn` prints the DIFFERENCE,
 * because the off-side charge is already inside the price above the tick — so
 * with Regular at +20 the Eggless box read "+60" rather than the +80 the owner
 * had entered. Clearing the 20 makes both numbers say what was meant: the cake
 * is 999, and eggless costs 80 more.
 *
 * The shop asked for this specifically. Nothing else on the product moves — not
 * the Eggless price, not a label, not a default.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const PRODUCT = "product-388cae22-8740-4632-95c3-d65bba2e2037";
const GROUP = "group-c60009a6";
const OPTION = "opt-67538a03";

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const products = mongoose.connection.db.collection("products");

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");

const doc = await products.findOne({ _id: PRODUCT });
if (!doc) throw new Error("no such product: " + PRODUCT);

const group = (doc.variantGroups ?? []).find((entry) => entry.id === GROUP);
if (!group) throw new Error("no such group: " + GROUP);

const option = (group.options ?? []).find((entry) => entry.id === OPTION);
if (!option) throw new Error("no such option: " + OPTION);

console.log(`\n${doc.name} — price field says ${doc.price}`);
console.log(`   group ${JSON.stringify(group.name)}`);
for (const entry of group.options) {
  const change = entry.id === OPTION ? `  ->  +0` : "";
  console.log(
    `     - ${entry.label} +${entry.priceAdjustment}${entry.isDefault ? " [DEFAULT]" : ""}${change}`,
  );
}

if (option.priceAdjustment === 0) {
  console.log("\nalready 0 — nothing to do");
} else if (APPLY) {
  const after = (doc.variantGroups ?? []).map((entry) =>
    entry.id !== GROUP
      ? entry
      : {
          ...entry,
          options: entry.options.map((candidate) =>
            candidate.id === OPTION ? { ...candidate, priceAdjustment: 0 } : candidate,
          ),
        },
  );

  const result = await products.updateOne(
    { _id: PRODUCT },
    { $set: { variantGroups: after, updatedAt: new Date().toISOString() } },
  );
  console.log(`\nmatched=${result.matchedCount} modified=${result.modifiedCount}`);
} else {
  console.log("\nnothing written");
}

await mongoose.disconnect();
