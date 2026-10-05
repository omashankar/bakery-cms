/**
 * One-off data repair: option blocks that ask a question become things to tick.
 *
 * Run:  node --env-file=.env.local scripts/split-option-blocks-into-tickboxes.mjs
 *       node --env-file=.env.local scripts/split-option-blocks-into-tickboxes.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints every block it would split, the block
 * it would produce, and the price on every product before and after.
 *
 * Why this exists
 * ---------------
 * The shop owner asked for one shape of option and one only: a tickbox with a
 * word and a price, which the customer ticks and the price moves — and, when he
 * wants it stated rather than offered, he ticks it himself and the page says
 *
 *     ✓ Eggless
 *
 * The editor makes exactly that now. The stored data does not: twenty-five
 * products carry a "Shape" holding Round, Square and Heart, and twenty-two an
 * "Egg preference" holding Regular and Eggless. Those render as rows of buttons,
 * which is the shape he asked to remove.
 *
 * The rule, and why it does not move a rupee
 * ------------------------------------------
 * A block with a default is really a default PLUS a list of departures from it.
 * `calculateVariantAdjustment` charges the CHOSEN option's adjustment, not the
 * sum — so with the default priced at zero:
 *
 *     nothing chosen  →  base + 0        Regular is what you get
 *     Eggless chosen  →  base + 80
 *
 * and after the split, with Regular gone and Eggless an unticked box:
 *
 *     nothing ticked  →  base + 0        Regular is still what you get
 *     Eggless ticked  →  base + 80
 *
 * Identical on both paths. The default option is not deleted so much as
 * recognised for what it was: the state of having chosen nothing.
 *
 * THAT HOLDS ONLY WHILE THE DEFAULT IS FREE. A default priced at ₹120 is inside
 * every price the shop shows, and dropping it takes ₹120 off the product. This
 * refuses to touch any such block and names it instead — a price change is the
 * shop's decision, not a migration's.
 *
 * What the customer loses, and it is worth saying out loud: the choices become
 * independent, so nothing stops both Square and Heart being ticked at once. That
 * is inherent in the shape the owner chose, and it is what the reference
 * storefront does — it offers "♡ Heart Shape" as one tickbox and says nothing
 * about round.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), ".snapshots");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

await mongoose.connect(uri);
const products = mongoose.connection.db.collection("products");

/** The price the page and the card show: tier 0, plus every block's default. */
const shown = (product, groups = product.variantGroups ?? []) =>
  (product.weights?.[0]?.price || product.price) +
  groups.reduce(
    (total, group) =>
      total + ((group.options ?? []).find((option) => option.isDefault)?.priceAdjustment ?? 0),
    0,
  );

const rows = await products.find({}).toArray();

const refused = [];
const planned = [];

for (const product of rows) {
  const groups = product.variantGroups ?? [];
  if (!groups.some((group) => (group.options ?? []).length > 1)) continue;

  const next = [];
  let blocked = false;

  for (const group of groups) {
    const options = group.options ?? [];
    if (options.length <= 1) {
      next.push(group);
      continue;
    }

    const fallback = options.find((option) => option.isDefault);
    const held = Number(fallback?.priceAdjustment ?? 0);

    if (held !== 0) {
      // Dropping this would take `held` off every price the shop shows.
      refused.push(`${product.name}: "${group.name}" — its default "${fallback.label}" holds ₹${held}`);
      blocked = true;
      next.push(group);
      continue;
    }

    for (const option of options) {
      // The default IS the state of having ticked nothing. It does not become a
      // box; it becomes the absence of one.
      if (option.isDefault) continue;
      const label = (option.label ?? "").trim();
      if (!label) continue;

      next.push({
        id: `group-${randomUUID().slice(0, 8)}`,
        // Named after the thing, because that is what the customer reads — and
        // `formatVariantSummary` prints a matching name and label once.
        name: label,
        // Carried, so a shape stays hidden by the Shape module exactly as it is
        // today. This migration changes what a block LOOKS like, nothing else.
        type: group.type,
        required: group.required,
        options: [
          {
            id: `opt-${randomUUID().slice(0, 8)}`,
            label,
            priceAdjustment: Number(option.priceAdjustment ?? 0),
            isDefault: false,
          },
        ],
      });
    }
  }

  if (!blocked) planned.push({ product, next });
}

console.log(`${rows.length} products, ${planned.length} to change, ${refused.length} block(s) refused\n`);

for (const { product, next } of planned.slice(0, 6)) {
  console.log(`${product.name}`);
  console.log(`  before: ${(product.variantGroups ?? []).map((g) => `${g.name}{${(g.options ?? []).map((o) => `${o.label}${o.isDefault ? "*" : ""}${o.priceAdjustment ? "+" + o.priceAdjustment : ""}`).join(",")}}`).join("  ")}`);
  console.log(`  after:  ${next.map((g) => `${g.name}{${g.options.map((o) => `${o.label}${o.isDefault ? "*" : ""}${o.priceAdjustment ? "+" + o.priceAdjustment : ""}`).join(",")}}`).join("  ")}`);
  console.log(`  price:  ₹${shown(product)} → ₹${shown(product, next)}`);
}
if (planned.length > 6) console.log(`… and ${planned.length - 6} more, the same shape`);

const moved = planned.filter(({ product, next }) => shown(product) !== shown(product, next));
console.log(`\nPRODUCTS WHOSE PRICE WOULD MOVE: ${moved.length}`);
for (const { product, next } of moved) {
  console.log(`  ${product.name}: ₹${shown(product)} → ₹${shown(product, next)}`);
}

if (refused.length) {
  console.log(`\nLEFT ALONE, because dropping the default would change the price:`);
  for (const line of refused) console.log(`  ${line}`);
}

if (!APPLY) {
  console.log("\nDRY RUN. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

if (moved.length) {
  console.log("\nREFUSING TO RUN: a price would move. Nothing above should do that.");
  await mongoose.disconnect();
  process.exit(1);
}

mkdirSync(SNAPSHOT_DIR, { recursive: true });
writeFileSync(
  join(SNAPSHOT_DIR, `before-option-split-${planned.length}.json`),
  JSON.stringify(planned.map(({ product }) => product), null, 2),
);
console.log(`\nSnapshot of ${planned.length} product(s) written to scripts/.snapshots/`);

for (const { product, next } of planned) {
  await products.updateOne({ _id: product._id }, { $set: { variantGroups: next } });
}

const after = await products.find({}).toArray();
const left = after.filter((p) => (p.variantGroups ?? []).some((g) => (g.options ?? []).length > 1));
console.log(`\n${planned.length} product(s) updated.`);
console.log(
  left.length
    ? `Still holding a multi-choice block: ${left.map((p) => p.name).join(", ")}`
    : "No multi-choice block left anywhere.",
);

await mongoose.disconnect();
