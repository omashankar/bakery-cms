/**
 * One-off: the default option is the DEAREST one on three of the shop's own
 * products, so each lists for more than the price its owner typed.
 *
 * Run:  node --env-file=.env.local scripts/fix-owner-variant-defaults.mjs
 *       node --env-file=.env.local scripts/fix-owner-variant-defaults.mjs --apply
 *
 * DRY RUN unless --apply is passed.
 *
 * Why
 * ---
 * A group's default is what the customer gets by NOT choosing, and both the
 * grid card and the product page price it in before anybody touches anything —
 * `defaultProductUnitPrice` and `calculateProductUnitPrice` both fall back to
 * `options.find((item) => item.isDefault)`. So a group whose default carries the
 * surcharge silently raises the product's advertised price:
 *
 *   Birthday Cake          999 listed as 1079   (Eggless +80 is the default)
 *   Baby Shower Cake       699 listed as  799   (Eggless +100 is the default)
 *   Sliver Anniversary     999 listed as 1079   (Eggless +80 is the default)
 *
 * It also changes how the group RENDERS. `asAddOn` reads the default as the
 * "off" side and refuses a tick whose "on" side is cheaper (`extra <= 0`), so
 * these appear as a titled row of two buttons while every other product in the
 * shop shows a single tickbox. The one-option group is worse: `asAddOn` declines
 * a single option that IS the default — "a box the customer cannot untick is not
 * a choice" — so Baby Shower Cake renders a mandatory +100 with no way to say no.
 *
 * What this changes, and what it does not
 * --------------------------------------
 * Only which option carries `isDefault`. Not one price, label, name or option is
 * touched — those are the shop's own words and figures. The rule applied is the
 * one the rest of the catalogue already follows: the CHEAPEST option is the
 * default, because that is what "I did not ask for anything extra" costs.
 *
 * The shop's fourth hand-made product, ring-ceremony-special-cake, is already
 * right (one option, no default -> a plain tickbox) and is not listed here.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

/**
 * product _id -> [group id, the option id that should carry the default or null
 * to clear it entirely, and what the shop sees change].
 */
const FIX_DEFAULT = {
  "product-388cae22-8740-4632-95c3-d65bba2e2037": [
    "group-c60009a6",
    "opt-67538a03",
    "Regular becomes the default, so Eggless becomes a tick rather than a preselection",
  ],
  "product-331875cb-b7f6-4258-948a-5fd762dbd952": [
    "group-965b0cc8",
    null,
    "the single Eggless option stops being the default, so it becomes a tick the customer can leave alone",
  ],
  "product-ae229fd2-38fb-4c63-88fc-77b7c22a60ee": [
    "group-f3f1bb78",
    "opt-390c6328",
    "Regular becomes the default (archived product, fixed for whenever it comes back)",
  ],
};

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const products = mongoose.connection.db.collection("products");

const now = new Date().toISOString();
let written = 0;

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");

for (const [id, [groupId, defaultOptionId, why]] of Object.entries(FIX_DEFAULT)) {
  const doc = await products.findOne({ _id: id });
  if (!doc) {
    console.log(`SKIP  ${id}: no such product`);
    continue;
  }

  const groups = doc.variantGroups ?? [];
  const target = groups.find((group) => group.id === groupId);
  if (!target) {
    console.log(`SKIP  ${id}: group ${groupId} is gone`);
    continue;
  }
  if (defaultOptionId && !(target.options ?? []).some((o) => o.id === defaultOptionId)) {
    console.log(`SKIP  ${id}: option ${defaultOptionId} is gone`);
    continue;
  }

  const after = groups.map((group) =>
    group.id !== groupId
      ? group
      : {
          ...group,
          options: (group.options ?? []).map((option) => ({
            ...option,
            isDefault: option.id === defaultOptionId,
          })),
        },
  );

  console.log(`\n${id}  (${doc.name})  listed at ${doc.name ? doc.price : "?"}`);
  console.log(`   ${why}`);
  console.log(`   group ${JSON.stringify(target.name)}`);
  const nextOptions = after.find((g) => g.id === groupId).options;
  for (const option of target.options ?? []) {
    const next = nextOptions.find((o) => o.id === option.id);
    const was = option.isDefault ? " [DEFAULT]" : "";
    const willBe = next.isDefault ? " [DEFAULT]" : "";
    console.log(
      `     - ${option.label} +${option.priceAdjustment}${was}${was === willBe ? "" : `  ->${willBe || " (no default)"}`}`,
    );
  }

  if (APPLY) {
    const result = await products.updateOne(
      { _id: id },
      { $set: { variantGroups: after, updatedAt: now } },
    );
    console.log(`   matched=${result.matchedCount} modified=${result.modifiedCount}`);
    written += result.modifiedCount;
  }
}

console.log(`\n${APPLY ? `${written} products written` : "nothing written"}`);
await mongoose.disconnect();
