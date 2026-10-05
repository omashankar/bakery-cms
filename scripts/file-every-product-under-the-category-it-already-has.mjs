/**
 * One-off data repair: every product written before a product could be filed
 * in more than one place.
 *
 * Run:  node --env-file=.env.local scripts/file-every-product-under-the-category-it-already-has.mjs
 *       node --env-file=.env.local scripts/file-every-product-under-the-category-it-already-has.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints every document it would touch.
 *
 * Why this exists
 * ---------------
 * `categoryIds` holds every category a product is filed under, primary first.
 * Products written before it existed carry `categoryId` and nothing else.
 *
 * Nothing is BROKEN by that: `normalizeCommerceFields` derives the array from
 * `categoryId` on every read, so the storefront, the counts and the admin all
 * behave. This is about the one thing a read-time default cannot reach — a
 * query. A `$match` or an index on `categoryIds` sees only what the documents
 * actually hold, and today half of them hold nothing. Writing the field the
 * code already assumes is what lets the database answer for itself later,
 * instead of every caller loading the whole catalogue first.
 *
 * It is deliberately the smallest possible write:
 *
 *   - Only documents where `categoryIds` is MISSING or EMPTY. A product the
 *     shop has already filed in two places is never touched, so this cannot
 *     undo a real choice by re-deriving the array from the primary.
 *   - The value is `[categoryId]` — the category the product already has. This
 *     adds no membership and removes none. Every category page shows exactly
 *     what it showed before.
 *   - A product with no `categoryId` at all is REPORTED and skipped, never
 *     given `[]` or guessed at. An unfiled product is a thing for a person to
 *     look at.
 *
 * Safe to run twice: the second run finds nothing left to do.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

await mongoose.connect(uri);
const products = mongoose.connection.db.collection("products");

// The one fact you check before writing to a live shop, and the dry run did
// not print it: WHICH shop. A dry run against a scratch database read exactly
// like a dry run against production.
console.log(
  `${APPLY ? "APPLY" : "DRY RUN"} against ${mongoose.connection.name} ` +
    `on ${mongoose.connection.host}:${mongoose.connection.port}\n`,
);

/**
 * Missing, or present but empty.
 *
 * `$size: 0` alone misses the documents that have no field, and
 * `$exists: false` alone misses the ones a half-finished write left as `[]`.
 * Both are "filed nowhere", and both are what this repairs.
 */
const UNFILED = {
  $or: [{ categoryIds: { $exists: false } }, { categoryIds: { $size: 0 } }],
};

const total = await products.countDocuments({});
const rows = await products
  .find(UNFILED, { projection: { name: 1, slug: 1, categoryId: 1, categoryIds: 1 } })
  .toArray();

/**
 * The shapes UNFILED cannot see, counted BEFORE anything is written.
 *
 * `$size` matches arrays only and `$exists: false` is false for `null`, so a
 * document holding `categoryIds: null` or a bare string matches neither branch:
 * not written, not reported, and not in the `left` count afterwards either —
 * self-consistently invisible. Worse, the verification below uses $arrayElemAt,
 * which raises a server error on a non-array, so such a document would take the
 * readback down AFTER every write had landed.
 *
 * Nothing can produce this today — the Mongoose path is `[String]`, the Zod
 * schema is an array, and no other script writes the field — so this is a
 * tripwire, not a repair. It refuses to run rather than discover it late.
 */
const malformed = await products
  .find(
    {
      categoryIds: { $exists: true, $not: { $type: "array" } },
    },
    { projection: { name: 1, slug: 1, categoryIds: 1 } },
  )
  .toArray();

if (malformed.length) {
  console.log(
    `${malformed.length} product(s) hold a categoryIds that is not an array. ` +
      "This script can neither see nor verify them, so it is writing nothing. " +
      "Look at these first:",
  );
  for (const row of malformed) {
    console.log(`  ${row.name ?? row.slug} — ${JSON.stringify(row.categoryIds)}`);
  }
  await mongoose.disconnect();
  process.exit(1);
}

console.log(`${total} products, ${rows.length} of them filed nowhere\n`);

let planned = 0;
let written = 0;
const unfilable = [];
const oddlyTyped = [];
const touched = [];

for (const row of rows) {
  /**
   * NOT TRIMMED. The value written must be the value the reader derives.
   *
   * This used to write `row.categoryId.trim()`, which is the only place in
   * the change where the script normalised differently from the code it
   * mirrors: `fileUnderCategories` only drops falsy entries, it never trims.
   * A document holding `categoryId: " 1 "` derives one membership today and
   * would have held TWO afterwards — `[" 1 ", "1"]` — because the Set has
   * two different strings to keep. That is a product appearing on a category
   * page nobody filed it under, and it breaks the invariant this script's own
   * readback then asserts.
   *
   * `trimmed` survives only to decide whether there is a category at all.
   */
  const primary = row.categoryId;
  const trimmed = typeof primary === "string" ? primary.trim() : "";

  if (typeof primary !== "string" && primary != null) {
    /**
     * A non-string id. Reported as what it is, NOT as "no category".
     *
     * `fileUnderCategories` filters on truthiness alone, so a numeric id is
     * live: the product IS filed today. Calling that "has no categoryId" and
     * telling the operator to give it one in the admin would talk them into
     * overwriting a real filing.
     */
    oddlyTyped.push(row);
    console.log(
      `SKIP  ${row.name ?? row.slug} — categoryId is a ${typeof primary} ` +
        `(${JSON.stringify(primary)}), not a string; filed today, left alone`,
    );
    continue;
  }

  if (!trimmed) {
    // No category at all. Not this script's call to invent one.
    unfilable.push(row);
    console.log(`SKIP  ${row.name ?? row.slug} — has no categoryId either`);
    continue;
  }

  // Quoted, so the log can tell the string "1" from the number 1 — and "1"
  // is a real live category id here.
  console.log(`PLAN  ${row.name ?? row.slug} — categoryIds: [${JSON.stringify(primary)}]`);
  planned += 1;

  if (APPLY) {
    try {
      // Guarded by the same condition that selected it, so a product filed in
      // two places by someone between the read above and this write is left
      // alone rather than flattened back to its primary.
      const result = await products.updateOne(
        { _id: row._id, ...UNFILED },
        { $set: { categoryIds: [primary] } },
      );
      // The DRIVER's count, not the plan's. In exactly the case the guard
      // exists for — someone files the product between the read and this
      // write — nothing is written, and counting the plan would report a
      // write that never happened.
      written += result.modifiedCount;
      if (result.modifiedCount === 0) {
        console.log(
          `      …no write: it was filed, or deleted, since the read above`,
        );
      } else {
        touched.push(row._id);
      }
    } catch (error) {
      /**
       * Stop on the first failure, and say where it stopped.
       *
       * An unhandled rejection here would skip the summary, the readback and
       * the disconnect, leaving an operator with a stack trace over a list of
       * PLAN lines and no idea which of them landed. Re-running is safe — the
       * selector only matches what is still unfiled — and this is the moment
       * to say so, not the header comment.
       */
      console.log(
        `\nFAILED on ${row.name ?? row.slug} after ${written} write(s): ${error.message}`,
      );
      console.log("Nothing is half-written — each product is its own update.");
      console.log("Re-running is safe: it will pick up where this stopped.");
      await mongoose.disconnect();
      process.exit(1);
    }
  }
}

console.log(
  APPLY
    ? `\n${written} product${written === 1 ? "" : "s"} UPDATED` +
        (written === planned ? "." : ` — ${planned} were planned.`)
    : `\n${planned} product${planned === 1 ? "" : "s"} would be updated.`,
);
if (unfilable.length) {
  console.log(
    `${unfilable.length} left alone because they carry no category at all — ` +
      "give them one in the admin, then re-run.",
  );
}
if (oddlyTyped.length) {
  console.log(
    `${oddlyTyped.length} left alone because their categoryId is not a string. ` +
      "They ARE filed — fix the value, do not re-file them.",
  );
}
if (!APPLY && planned > 0) console.log("Re-run with --apply to write.");

if (APPLY) {
  // Read back, so the report is what the database holds rather than what was sent.
  const left = await products.countDocuments(UNFILED);
  /**
   * Scoped to what THIS run wrote.
   *
   * Collection-wide, it would report drift this migration did not cause and
   * give nothing to look at — and drift is reachable: `updateProduct` merges
   * `{ ...existing, ...data }` and `categoryIds` is deliberately optional in
   * the schema, so a client that omits it while changing `categoryId` leaves
   * the two disagreeing. That is a real bug; it is not this one, and a
   * migration's verification must only answer for its own writes.
   */
  const mismatched = touched.length
    ? await products
        .find(
          {
            _id: { $in: touched },
            $expr: { $ne: [{ $arrayElemAt: ["$categoryIds", 0] }, "$categoryId"] },
          },
          { projection: { name: 1, slug: 1, categoryId: 1, categoryIds: 1 } },
        )
        .toArray()
    : [];

  const leftIsWrong = left !== unfilable.length + oddlyTyped.length;
  console.log(
    `\nAfter: ${left} still filed nowhere ` +
      `(expected ${unfilable.length + oddlyTyped.length})${leftIsWrong ? "  <-- WRONG" : ""}`,
  );
  console.log(
    `       ${mismatched.length} of the ${touched.length} written have a first ` +
      `categoryIds entry that is not their categoryId ` +
      `(expected 0)${mismatched.length ? "  <-- WRONG" : ""}`,
  );
  for (const row of mismatched) {
    console.log(
      `         ${row.name ?? row.slug}: categoryId=${JSON.stringify(row.categoryId)} ` +
        `categoryIds=${JSON.stringify(row.categoryIds)}`,
    );
  }

  /**
   * A bad outcome EXITS NON-ZERO.
   *
   * These two numbers were printed beside the values they were expected to
   * be and never compared, so a half-applied migration read exactly like a
   * clean one — in the same neutral tone, and with the same exit code a
   * deploy hook or a CI step would have believed.
   */
  if (leftIsWrong || mismatched.length) {
    console.log("\nThe write did not land the way it was planned. Do not re-run");
    console.log("blind — read the lines marked WRONG above first.");
    await mongoose.disconnect();
    process.exit(1);
  }
}

await mongoose.disconnect();
