/**
 * WHICH ROWS ARE CARDS, AND WHICH ROWS ARE NOT THERE AT ALL.
 *
 *   node --env-file=.env.local scripts/draw-the-rows-the-way-the-layout-draws-them.mjs
 *   …add --apply to write.
 *
 * Two things, both settings rather than content:
 *
 * 1. The rows the layout lifts out of the page get the `panel` background —
 *    a rounded tinted box inset from the edges rather than a full-width
 *    stripe. In the layout being followed those are the bestseller rails, the
 *    trending row and the trust strip.
 *
 * 2. The rows that layout does not have at all are switched OFF.
 *
 * NOTHING IS DELETED. "Off" means `isVisible: false`: the band keeps its
 * content, stays in the builder, and one click brings it back. That matters
 * more than usual here — two of the three carry real commerce.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const EXPECT_VERSION = 23;

/** Rows drawn as a card rather than a stripe. */
const PANEL = [
  "tabbed-rail-top",
  "tabbed-rail-lower",
  "trending-5",
  "best-sellers-6",
  "why-us-12",
];

/**
 * Rows the layout does not have.
 *
 * offers-7      a band of coupon cards. The shop has four live coupons and
 *               they still work at checkout — this only stops the homepage
 *               advertising them.
 * newsletter-17 THE ONE WORTH THINKING ABOUT. This is the only email capture
 *               on the storefront. Off means the shop stops collecting
 *               addresses from its homepage.
 * cta-18        the closing call to action, with the shop's phone number on
 *               it. That number is not shown anywhere else on the homepage.
 */
const SWITCH_OFF = ["offers-7", "newsletter-17", "cta-18"];

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
  const sections = (store.data?.[which]?.sections ?? []).slice().sort((a, b) => a.order - b.order);
  const ledger = [];

  const out = sections.map((section) => {
    const id = section.instanceId;
    const wantsPanel = PANEL.includes(id);
    const wantsOff = SWITCH_OFF.includes(id);

    const background = wantsPanel ? "panel" : section.background;
    const isVisible = wantsOff ? false : section.isVisible;

    const changes = [];
    if (background !== section.background) changes.push(`bg ${section.background}->panel`);
    if (isVisible !== section.isVisible) changes.push("switched OFF");
    if (changes.length) {
      ledger.push(`${(section.type ?? "").padEnd(15)} ${id.padEnd(23)} ${changes.join(", ")}`);
    }

    return { ...section, background, isVisible };
  });

  const missing = [...PANEL, ...SWITCH_OFF].filter(
    (id) => !sections.some((s) => s.instanceId === id),
  );
  if (missing.length) throw new Error(`no such section: ${missing.join(", ")}`);

  return { sections: out, ledger };
}

const draft = rebuild("draft");
const published = rebuild("published");

console.log("changes (draft and published are the same document shape):");
for (const line of published.ledger) console.log("  " + line);

const visible = published.sections.filter((s) => s.isVisible !== false).length;
console.log(
  `\nvisible bands: ${store.data.published.sections.filter((s) => s.isVisible !== false).length}` +
    ` -> ${visible}, of ${published.sections.length} kept in the document`,
);
console.log(
  "\nnote: newsletter-17 is the storefront's only email capture, and cta-18 " +
    "carries the shop's phone number. Both keep their content and can be " +
    "switched back on in the builder.",
);

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
const rows = (after?.data?.published?.sections ?? [])
  .slice()
  .sort((a, b) => a.order - b.order)
  .filter((s) => s.isVisible !== false)
  .map((s) => `${s.order}:${s.type}${s.background === "panel" ? "[card]" : ""}`);
console.log("readback (visible): " + rows.join("  "));

await mongoose.disconnect();
