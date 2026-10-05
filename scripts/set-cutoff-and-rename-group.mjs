/**
 * Two settings the shop asked for, both of which it could have typed itself and
 * one of which it could not have made stick.
 *
 * Run:  node --env-file=.env.local scripts/set-cutoff-and-rename-group.mjs
 *       node --env-file=.env.local scripts/set-cutoff-and-rename-group.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * 1. `commerce.sameDayCutoff` = "14:00".
 *
 *    The shop now delivers same-day (`deliveryLeadDays` 0), so it needs a time
 *    after which today is no longer on offer — without one, a customer at 11pm
 *    can still ask for today. The field exists on the Commerce screen, labelled
 *    "Same-day orders close at", but it was never a Mongoose path, so anything
 *    typed there was dropped on write and the shop had no way to set it. That
 *    path is declared now; this writes the value the shop chose.
 *
 * 2. The variant group on baby-shower-cake, "family function " -> "Egg
 *    preference".
 *
 *    An internal note, with a trailing space, sitting in the field that names a
 *    choice to the customer. `formatVariantSummary` interpolates the group name
 *    raw — `${group.name}: ${option.label}` — and `cartLineChoices` joins that
 *    into the cart, the checkout summary, the customer's order page, the
 *    invoice, the kitchen ticket and the admin's own order screen. Every one of
 *    them read "family function : Eggless".
 *
 *    It does NOT appear on the product page any more: the group renders as an
 *    add-on tick, and a tick shows only its option label. So this was visible
 *    everywhere the choice is RECORDED and nowhere it is offered — which is why
 *    it went unnoticed.
 *
 *    "Egg preference" is what the shop's own ring-ceremony-special-cake calls
 *    the same thing, so the two now agree. The shop chose it.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const CUTOFF = "14:00";

const PRODUCT = "product-331875cb-b7f6-4258-948a-5fd762dbd952";
const GROUP = "group-965b0cc8";
const NEW_NAME = "Egg preference";

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const now = new Date().toISOString();
let written = 0;

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");

// ── 1. the closing time ─────────────────────────────────────────────────────
const settings = await db.collection("settings").findOne({});
console.log(
  `\nsettings ${settings._id}` +
    `\n   commerce.deliveryLeadDays = ${settings.commerce?.deliveryLeadDays}  (same-day)` +
    `\n   commerce.sameDayCutoff    = ${JSON.stringify(settings.commerce?.sameDayCutoff)}  ->  ${JSON.stringify(CUTOFF)}`,
);
if (APPLY) {
  const result = await db
    .collection("settings")
    .updateOne({ _id: settings._id }, { $set: { "commerce.sameDayCutoff": CUTOFF, updatedAt: now } });
  console.log(`   matched=${result.matchedCount} modified=${result.modifiedCount}`);
  written += result.modifiedCount;
}

// ── 2. the group's name ─────────────────────────────────────────────────────
const products = db.collection("products");
const doc = await products.findOne({ _id: PRODUCT });
if (!doc) throw new Error("no such product: " + PRODUCT);

const group = (doc.variantGroups ?? []).find((entry) => entry.id === GROUP);
if (!group) throw new Error("no such group: " + GROUP);

console.log(
  `\n${doc.name}` +
    `\n   group name ${JSON.stringify(group.name)}  ->  ${JSON.stringify(NEW_NAME)}` +
    `\n   recorded on a line as: ${JSON.stringify(`${group.name}: ${group.options?.[0]?.label}`)}` +
    `  ->  ${JSON.stringify(`${NEW_NAME}: ${group.options?.[0]?.label}`)}`,
);

if (group.name === NEW_NAME) {
  console.log("   already renamed — nothing to do");
} else if (APPLY) {
  const after = (doc.variantGroups ?? []).map((entry) =>
    entry.id === GROUP ? { ...entry, name: NEW_NAME } : entry,
  );
  const result = await products.updateOne(
    { _id: PRODUCT },
    { $set: { variantGroups: after, updatedAt: now } },
  );
  console.log(`   matched=${result.matchedCount} modified=${result.modifiedCount}`);
  written += result.modifiedCount;
}

console.log(`\n${APPLY ? `${written} documents written` : "nothing written"}`);
await mongoose.disconnect();
