/**
 * A SLOT FOR EVERY BANNER THE LAYOUT HAS.
 *
 *   node --env-file=.env.local scripts/give-every-banner-in-the-layout-a-place-to-live.mjs
 *   …add --apply to write.
 *
 * The previous script put the bands in order. This one adds the three that
 * exist purely to hold artwork and had nowhere to go:
 *
 *   promo-collage-split  a two-panel banner — the layout's "one side / other
 *                        side" split. Two cards, both ticked full-width.
 *   tile-grid-gifts      the big grid of small labelled picture tiles. Not
 *                        `categories`, which is driven by the catalogue and
 *                        can only point at a category page; these tiles are
 *                        pictures the shop uploads and links wherever it likes.
 *   tile-grid-global     the same shape again, a row of six.
 *
 * ADDITIVE ONLY. Nothing is reordered away, nothing is switched off, nothing
 * is deleted. All three arrive EMPTY — every renderer returns null on an empty
 * list, so none of them appears on the live page until the shop uploads
 * pictures. They appear in the builder immediately, which is the point: a
 * banner with nowhere to go is why they were missing.
 *
 * No wording, picture, count or claim is copied from anywhere. The only
 * strings written are the two `columns` numbers, which are layout.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const EXPECT_VERSION = 22;

/** Where each new band goes, named by the band it follows. */
const INSERT_AFTER = [
  {
    after: "photo-cakes-9",
    id: "promo-collage-split",
    type: "promo-collage",
    bg: "white",
    content: { overline: "", title: "", description: "", cards: "[]" },
    note: "two-panel split banner — tick Full width on both cards",
  },
  {
    after: "categories-3",
    id: "tile-grid-gifts",
    type: "tile-grid",
    bg: "cream",
    content: { overline: "", title: "", description: "", columns: 4, tiles: "[]" },
    note: "the big grid of labelled picture tiles",
  },
  {
    after: "tile-grid-gifts",
    id: "tile-grid-global",
    type: "tile-grid",
    bg: "white",
    content: { overline: "", title: "", description: "", columns: 6, tiles: "[]" },
    note: "a row of six picture tiles",
  },
];

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

const store = await stores.findOne({ _id: "homepage-sections" });
if (store?.data?.version !== EXPECT_VERSION) {
  console.log(
    `version is ${store?.data?.version}, expected ${EXPECT_VERSION}. ` +
      "Somebody has published since this was written — re-read before running.",
  );
  await mongoose.disconnect();
  process.exit(1);
}

function rebuild(which) {
  const sections = (store.data?.[which]?.sections ?? [])
    .slice()
    .sort((a, b) => a.order - b.order);

  const have = new Set(sections.map((s) => s.instanceId));
  const out = [];
  const ledger = [];

  /*
    CHAINED, because one of these follows another one of these.

    The first version walked the EXISTING bands and inserted after each. So
    `tile-grid-global`, whose anchor is `tile-grid-gifts`, never fired: its
    anchor was being created in the same pass and was not in the list being
    walked. Two of the three went in and the dry run showed it.

    Inserting after a band means: place it, then immediately ask whether
    anything is waiting on the band just placed, and keep going until nothing
    is. `have` stops a cycle from running forever.
  */
  const place = (id) => {
    for (const row of INSERT_AFTER) {
      if (row.after !== id) continue;
      if (have.has(row.id)) {
        ledger.push(`SKIP  ${row.id} — already there`);
        continue;
      }
      have.add(row.id);
      out.push({
        instanceId: row.id,
        type: row.type,
        order: 0, // renumbered below
        isVisible: true,
        background: row.bg,
        content: row.content,
      });
      ledger.push(`NEW   ${row.type.padEnd(14)} ${row.id.padEnd(22)} after ${row.after}`);
      place(row.id);
    }
  };

  for (const section of sections) {
    out.push(section);
    place(section.instanceId);
  }

  const missed = INSERT_AFTER.filter((row) => !have.has(row.id));
  if (missed.length) {
    throw new Error(
      `anchor not found for: ${missed.map((r) => `${r.id} (after ${r.after})`).join(", ")}`,
    );
  }

  // One pass of renumbering, so `order` matches position exactly.
  const renumbered = out.map((s, index) => ({ ...s, order: index }));
  return { sections: renumbered, ledger };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log(`draft:     ${store.data.draft?.sections?.length} -> ${draft.sections.length}`);
for (const line of draft.ledger) console.log("  " + line);
console.log(`\npublished: ${store.data.published?.sections?.length} -> ${published.sections.length}`);
for (const line of published.ledger) console.log("  " + line);

console.log("\norder after:");
for (const s of published.sections) {
  const row = INSERT_AFTER.find((r) => r.id === s.instanceId);
  console.log(
    `  ${String(s.order).padStart(2)}  ${s.isVisible === false ? "OFF" : " ON"}  ` +
      `${(s.type ?? "").padEnd(15)} ${(s.instanceId ?? "").padEnd(22)}` +
      (row ? `  <- NEW: ${row.note}` : ""),
  );
}

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply to write.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": EXPECT_VERSION },
  {
    $set: {
      "data.draft.sections": draft.sections,
      "data.published.sections": published.sections,
      "data.version": EXPECT_VERSION + 1,
      "data.updatedAt": new Date(),
    },
  },
);

if (result.matchedCount !== 1) {
  console.log("VERSION MOVED — nothing written. Re-read and run again.");
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
console.log(`\nWROTE. version ${store.data.version} -> ${after?.data?.version}`);
console.log(
  `readback: draft ${after?.data?.draft?.sections?.length}, ` +
    `published ${after?.data?.published?.sections?.length}`,
);

await mongoose.disconnect();
