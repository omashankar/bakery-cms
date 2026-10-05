/**
 * One-off data repair: a shape that ended up inside the egg question.
 *
 * Run:  node --env-file=.env.local scripts/put-the-shape-back-in-the-shape-block.mjs
 *       node --env-file=.env.local scripts/put-the-shape-back-in-the-shape-block.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints the document before and after, and
 * the price on every path, so nothing about the money is a surprise.
 *
 * Why this exists
 * ---------------
 * Ring Ceremony Special Cake carries ONE group, "Egg preference", holding:
 *
 *     Eggless   +80   (not the default)
 *     Heart     +20   (the default)
 *
 * and no Shape group at all. Heart is a shape. It is in the egg question, it is
 * priced at ₹20 that no other product charges for a shape, and being the default
 * it is added to every order — so the page reads ₹1,019 for a ₹999 cake.
 *
 * The shop owner confirms it was a slip. It is an easy one to make: the Type
 * control on the option editor offers "Shape" and "Custom" while 26 of this
 * shop's 29 products carry groups typed `egg` or `photo`, so the box renders
 * blank or wrong on most of the catalogue and one click retypes a group.
 *
 * What this restores, taken from how its two siblings already store the same
 * facts — Baby Shower Cake and Sliver Anniversary Cake:
 *
 *     Egg preference   Eggless +80, NOT default   (an opt-in tick, as on Baby Shower)
 *     Shape            Heart     ₹0, DEFAULT      (a stated fact, as on Sliver Anniversary)
 *
 * THE PRICE MOVES, and it moves DOWN: ₹1,019 → ₹999. The ₹20 was the accident,
 * and no other product in the shop charges for a shape. Nothing else changes —
 * the eggless tick keeps its ₹80 and keeps starting unticked.
 */
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SLUG = "ring-ceremony-special-cake";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

await mongoose.connect(uri);
const products = mongoose.connection.db.collection("products");

const show = (product) => {
  console.log(`  base ₹${product.price}`);
  for (const group of product.variantGroups ?? []) {
    console.log(`  ${group.name} [${group.type}]`);
    for (const option of group.options ?? []) {
      console.log(
        `      ${option.label.padEnd(10)} +₹${option.priceAdjustment ?? 0}` +
          `${option.isDefault ? "   DEFAULT" : ""}`,
      );
    }
  }
  // The same sum `calculateVariantAdjustment` makes: every group's default.
  const withDefaults = (product.variantGroups ?? []).reduce(
    (total, group) =>
      total + ((group.options ?? []).find((option) => option.isDefault)?.priceAdjustment ?? 0),
    0,
  );
  const tier = product.weights?.[0]?.price;
  console.log(`  → page and card show ₹${(tier || product.price) + withDefaults}`);
};

const before = await products.findOne({ slug: SLUG });
if (!before) throw new Error(`${SLUG} is not in this database`);

console.log("BEFORE");
show(before);

const eggGroup = (before.variantGroups ?? []).find(
  (group) => (group.name ?? "").trim().toLowerCase() === "egg preference",
);
const stray = (eggGroup?.options ?? []).find(
  (option) => (option.label ?? "").trim().toLowerCase() === "heart",
);

if (!eggGroup || !stray) {
  console.log("\nNothing to repair — the stray Heart is not where it was. Re-probe first.");
  await mongoose.disconnect();
  process.exit(0);
}
if ((before.variantGroups ?? []).some((group) => (group.name ?? "").trim().toLowerCase() === "shape")) {
  console.log("\nThis product already has a Shape group. Not touching it — look by hand.");
  await mongoose.disconnect();
  process.exit(0);
}

/** The egg question with the shape taken out of it, and nothing else changed. */
const repairedEgg = {
  ...eggGroup,
  options: (eggGroup.options ?? []).filter((option) => option.id !== stray.id),
};

/**
 * Its own Shape group, stored the way Sliver Anniversary already stores the
 * identical fact: one option, no price, Default ticked — so the page states it
 * and the order line carries it.
 */
const shapeGroup = {
  id: `group-${randomUUID().slice(0, 8)}`,
  name: "Shape",
  type: "shape",
  required: true,
  options: [
    {
      id: `opt-${randomUUID().slice(0, 8)}`,
      label: stray.label.trim(),
      priceAdjustment: 0,
      isDefault: true,
    },
  ],
};

const after = {
  ...before,
  variantGroups: [
    ...(before.variantGroups ?? []).map((group) => (group.id === eggGroup.id ? repairedEgg : group)),
    shapeGroup,
  ],
};

console.log("\nAFTER");
show(after);

if (!APPLY) {
  console.log("\nDRY RUN. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

// $set only the one path this touches, so a concurrent edit elsewhere on the
// document is not overwritten by a whole-document replace.
await products.updateOne({ _id: before._id }, { $set: { variantGroups: after.variantGroups } });

const readBack = await products.findOne({ _id: before._id });
console.log("\nWRITTEN. Read back from the database:");
show(readBack);

await mongoose.disconnect();
