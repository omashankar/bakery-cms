/**
 * One-off data repair: four cakes that are eggless and never say so.
 *
 * Run:  node --env-file=.env.local scripts/state-the-fact-on-already-eggless-cakes.mjs
 *       node --env-file=.env.local scripts/state-the-fact-on-already-eggless-cakes.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints every document it would touch.
 *
 * Why this exists
 * ---------------
 * `asStatement` gives a variant group with ONE option, marked Default, its own
 * rendering on the product page: a tick and the shop's own word.
 *
 *     ✓ Eggless
 *
 * That is code, and code alone changes nothing here — because the four cakes it
 * was built for carry no egg group at all. A migration removed theirs, and was
 * right to: they are named "Eggless Chocolate Fudge", "Eggless Vanilla Dream",
 * "Eggless Fruit Fantasy" and "Eggless Red Velvet", and charging ₹80 to make an
 * eggless cake eggless is not a choice. So the fact lives only in their names,
 * where nothing but a human reader can see it.
 *
 * This writes it where the software can. One group, one option, ₹0, Default
 * ticked. Three things follow, and none of them costs a customer anything:
 *
 *   1. The product page states it — the sign the shop asked for.
 *   2. The cart line, the invoice and the kitchen ticket carry
 *      "Egg preference: Eggless", so the person baking it is told.
 *   3. The collections sidebar grows an honest "Egg preference" box, and the
 *      Eggless tick starts matching these four on the fact rather than on the
 *      word in their name.
 *
 * Type `custom`, deliberately, NOT `egg`. `variantGroupsEnabledBy` deletes a
 * shape-typed group when the Shape module is off, and a fact should not vanish
 * from the page, the price and the order line because a switch moved.
 *
 * Every money path moves by exactly 0: `calculateVariantAdjustment` adds the
 * default's adjustment, which is 0; `defaultProductUnitPrice` and
 * `displayCompareAtPrice` read the same number; `priceLine` re-derives it
 * server-side. So checkout's "Prices have changed" guard cannot fire.
 */
import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const GROUP_NAME = "Egg preference";
const OPTION_LABEL = "Eggless";

/** The four, by slug — never by a name search, which would catch a rename. */
const SLUGS = [
  "eggless-chocolate-fudge",
  "eggless-vanilla-dream",
  "eggless-fruit-fantasy",
  "eggless-red-velvet",
];

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

await mongoose.connect(uri);
const products = mongoose.connection.db.collection("products");

const rows = await products
  .find({ slug: { $in: SLUGS } }, { projection: { name: 1, slug: 1, variantGroups: 1 } })
  .toArray();

console.log(`${rows.length} of ${SLUGS.length} slugs found\n`);

const missing = SLUGS.filter((slug) => !rows.some((row) => row.slug === slug));
if (missing.length) {
  console.log(`NOT FOUND, and not created: ${missing.join(", ")}\n`);
}

let planned = 0;
for (const row of rows) {
  const groups = row.variantGroups ?? [];
  const already = groups.find(
    (group) => (group?.name ?? "").trim().toLowerCase() === GROUP_NAME.toLowerCase(),
  );

  if (already) {
    // Never edit a group the shop already keeps. If it is there and wrong, that
    // is a decision for a person, not for this script.
    console.log(
      `SKIP  ${row.name} — already carries a "${already.name}" group ` +
        `{${(already.options ?? []).map((option) => option.label).join(", ")}}`,
    );
    continue;
  }

  const group = {
    id: `group-${randomUUID().slice(0, 8)}`,
    name: GROUP_NAME,
    type: "custom",
    required: true,
    options: [
      {
        id: `opt-${randomUUID().slice(0, 8)}`,
        label: OPTION_LABEL,
        priceAdjustment: 0,
        isDefault: true,
      },
    ],
  };

  console.log(`PLAN  ${row.name} — add ${GROUP_NAME} {${OPTION_LABEL}} ₹0, Default ticked`);
  planned += 1;

  if (APPLY) {
    // $push, not $set: whatever else the product already carries stays exactly
    // as it is, and a concurrent edit to another group is not overwritten.
    await products.updateOne({ _id: row._id }, { $push: { variantGroups: group } });
  }
}

console.log(
  `\n${planned} product${planned === 1 ? "" : "s"} ${APPLY ? "UPDATED" : "would be updated"}.`,
);
if (!APPLY && planned > 0) console.log("Re-run with --apply to write.");

if (APPLY) {
  // Read back, so the report is what the database holds rather than what was sent.
  const after = await products
    .find({ slug: { $in: SLUGS } }, { projection: { name: 1, variantGroups: 1 } })
    .toArray();
  console.log("\nAfter:");
  for (const row of after) {
    const shown = (row.variantGroups ?? [])
      .map(
        (group) =>
          `${group.name}{${(group.options ?? [])
            .map((option) => `${option.label}${option.isDefault ? "*" : ""}`)
            .join(",")}}`,
      )
      .join("  ");
    console.log(`  ${row.name}: ${shown || "-"}`);
  }
  console.log("\n(* = Default, which is what makes it a statement rather than an offer)");
}

await mongoose.disconnect();
