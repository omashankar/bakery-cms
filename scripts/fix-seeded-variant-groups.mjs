/**
 * One-off data repair: three seeded groups that the code no longer agrees with.
 *
 * Run:  node --env-file=.env.local scripts/fix-seeded-variant-groups.mjs
 *       node --env-file=.env.local scripts/fix-seeded-variant-groups.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints every document it would touch.
 *
 * Why this exists
 * ---------------
 * An earlier seed wrote variant groups onto every demo product. The seed no
 * longer writes them (`mapLandingProductToAdmin` sets `variantGroups: []`), but
 * the rows it already wrote are still in the database, and two of them now say
 * something the shop does not mean:
 *
 *   1. eg-1..eg-4 are the four cakes whose NAME and DESCRIPTION both say
 *      eggless. Their "Egg preference" group has Eggless at +80 and marked
 *      `isDefault` — so `calculateVariantAdjustment` adds ₹80 to a cake that is
 *      already eggless, on the product page and on the grid card alike
 *      (₹1099 renders as ₹1179). And because the default is the DEARER option,
 *      `asAddOn` computes `extra = -80`, hits its `extra <= 0` guard and returns
 *      null — so it renders as a titled row of two buttons offering "Regular",
 *      a version of the cake the shop does not make.
 *
 *   2. pc-1..pc-4 carry a "Photo cake" group with a paid "Custom photo print"
 *      at +250 beside a free "Standard design". A product that takes a
 *      photograph takes one, and the price of printing is part of its price —
 *      the group was removed from the seed for exactly that reason, and the
 *      product page now offers the uploader off `allowsPhotoUpload` alone. The
 *      stored group put a second, paid answer beside the free one.
 *
 * What it deliberately does NOT touch
 * -----------------------------------
 * The "Egg preference" group on the other seeded cakes: there Regular is the
 * default and Eggless is a real +80 upgrade, which `asAddOn` renders as the
 * tickbox the shop wants. The "Shape" groups. And every product whose `_id`
 * begins "product-" — those are the shop's own, typed by hand in the admin, and
 * a script has no business rewriting a merchant's choices.
 *
 * Each target is named by BOTH its product `_id` and the exact group id, so this
 * can only ever touch the eight documents it lists — never a query-shaped delete
 * that could also match something written later.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/** product _id -> [the one group id to drop, why it is wrong]. */
const DROP_GROUP = {
  "eg-1": ["group-26948cdd", "Egg preference on a cake that is already eggless"],
  "eg-2": ["group-22c05060", "Egg preference on a cake that is already eggless"],
  "eg-3": ["group-84deeaec", "Egg preference on a cake that is already eggless"],
  "eg-4": ["group-132e0f59", "Egg preference on a cake that is already eggless"],
  "pc-1": ["group-dbb45e92", "paid Custom photo print beside the free uploader"],
  "pc-2": ["group-0eac67e2", "paid Custom photo print beside the free uploader"],
  "pc-3": ["group-e9abb4fa", "paid Custom photo print beside the free uploader"],
  "pc-4": ["group-1f9a127c", "paid Custom photo print beside the free uploader"],
};

/** The shop delivers same-day. `earliestDeliveryDateString` floors on this. */
const DELIVERY_LEAD_DAYS = 0;

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const products = db.collection("products");
const settings = db.collection("settings");

const now = new Date().toISOString();
let written = 0;

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");

for (const [id, [groupId, why]] of Object.entries(DROP_GROUP)) {
  const doc = await products.findOne({ _id: id });
  if (!doc) {
    console.log(`SKIP  ${id}: no such product`);
    continue;
  }

  const before = doc.variantGroups ?? [];
  const target = before.find((group) => group.id === groupId);
  if (!target) {
    console.log(`SKIP  ${id}: ${groupId} is already gone`);
    continue;
  }
  const after = before.filter((group) => group.id !== groupId);

  console.log(`\n${id}  (${doc.name})  — dropping ${why}`);
  console.log(`   group ${JSON.stringify(target.name)} type=${JSON.stringify(target.type)}`);
  for (const option of target.options ?? []) {
    console.log(
      `     - ${option.label} +${option.priceAdjustment}${option.isDefault ? "  [DEFAULT]" : ""}`,
    );
  }
  console.log(
    `   groups ${before.length} -> ${after.length}; kept: ${after.map((g) => g.name).join(", ") || "(none)"}`,
  );

  if (APPLY) {
    const result = await products.updateOne(
      { _id: id },
      { $set: { variantGroups: after, updatedAt: now } },
    );
    console.log(`   matched=${result.matchedCount} modified=${result.modifiedCount}`);
    written += result.modifiedCount;
  }
}

const shop = await settings.findOne({});
console.log(
  `\nsettings ${shop._id}: commerce.deliveryLeadDays ${shop.commerce?.deliveryLeadDays} -> ${DELIVERY_LEAD_DAYS}`,
);
if (APPLY) {
  const result = await settings.updateOne(
    { _id: shop._id },
    { $set: { "commerce.deliveryLeadDays": DELIVERY_LEAD_DAYS, updatedAt: now } },
  );
  console.log(`   matched=${result.matchedCount} modified=${result.modifiedCount}`);
  written += result.modifiedCount;
}

console.log(`\n${APPLY ? `${written} documents written` : "nothing written"}`);
await mongoose.disconnect();
