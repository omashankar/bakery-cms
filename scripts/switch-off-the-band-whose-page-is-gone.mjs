/**
 * THE WEDDING BAND, AFTER THE WEDDING PAGE.
 *
 *   node --env-file=.env.local scripts/switch-off-the-band-whose-page-is-gone.mjs
 *   …add --apply to write.
 *
 * The homepage's Wedding Collection band advertised /store/wedding-cakes and
 * was drawn by a section type that has just been removed from the registry. It
 * is still in the shop's stored layout, where it now renders nothing — the
 * switch in the renderer falls through to `null` for a type it does not know.
 *
 * Switched off rather than removed, like every other band this shop has
 * retired: the content stays in the document, so nothing is lost if the shop
 * ever wants those words back for a different band.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const EXPECT_VERSION = 24;
const ID = "wedding-8";

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log(`db: ${db.databaseName}`);
console.log(APPLY ? "=== APPLYING ===\n" : "=== DRY RUN — pass --apply to write ===\n");

const store = await stores.findOne({ _id: "homepage-sections" });
if (store?.data?.version !== EXPECT_VERSION) {
  console.log(`version is ${store?.data?.version}, expected ${EXPECT_VERSION} — re-read first.`);
  await mongoose.disconnect();
  process.exit(1);
}

function rebuild(which) {
  const sections = store.data?.[which]?.sections ?? [];
  let found = false;
  const out = sections.map((s) => {
    if (s.instanceId !== ID) return s;
    found = true;
    return { ...s, isVisible: false };
  });
  return { sections: out, found };
}

const draft = rebuild("draft");
const published = rebuild("published");

if (!draft.found && !published.found) {
  console.log(`${ID} is not in either list — nothing to do.`);
  await mongoose.disconnect();
  process.exit(0);
}

const before = published.sections.filter((s) => s.isVisible !== false).length;
console.log(`${ID}: switched off in draft=${draft.found}, published=${published.found}`);
console.log(`visible bands: ${store.data.published.sections.filter((s) => s.isVisible !== false).length} -> ${before}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written.");
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
  console.log("VERSION MOVED — nothing written.");
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
console.log(`\nWROTE. version ${store.data.version} -> ${after?.data?.version}`);

await mongoose.disconnect();
