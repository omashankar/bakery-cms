/**
 * CONTACT AND FAQ LEAVE THE HEADER; THE FOOTER ALREADY HAS THEM.
 *
 *   node --env-file=.env.local scripts/contact-and-faq-live-in-the-footer.mjs
 *   …add --apply to write.
 *
 * Checked before writing: both pages are already linked from the footer —
 * FAQ under "Quick Links", Contact under "Company" — so nothing becomes
 * unreachable. The script refuses to run if that stops being true.
 *
 * HIDDEN, NOT DELETED. The header admin has a visibility switch and these
 * rows keep their label, link and position; a shop that wants them back
 * flicks the switch rather than typing them again. Deleting is one click away
 * in the same screen if that is what they meant.
 */
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const HIDE = ["/store/contact", "/store/faq"];

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const stores = db.collection("cmsstores");

console.log("db: " + db.databaseName);
console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===");
console.log("");

/* ---- the footer must already carry them, or this strands a page --------- */
const footerDoc = await stores.findOne({ _id: "footer" });
const inFooter = new Set(
  (footerDoc?.data?.columns ?? []).flatMap((column) =>
    (column.links ?? []).map((link) => String(link.href ?? "").trim()),
  ),
);
const stranded = HIDE.filter((href) => !inFooter.has(href));
if (stranded.length) {
  console.log("  the footer does not link " + stranded.join(" or ") + " — refusing to hide it");
  await mongoose.disconnect();
  process.exit(1);
}
console.log("  the footer already links both:");
for (const column of footerDoc.data.columns ?? []) {
  for (const link of column.links ?? []) {
    if (HIDE.includes(String(link.href ?? "").trim())) {
      console.log("    " + column.title + " -> " + link.label + "  " + link.href);
    }
  }
}
console.log("");

const header = await stores.findOne({ _id: "header" });
const nav = header?.data?.nav ?? [];
const next = nav.map((row) =>
  HIDE.includes(String(row.href ?? "").trim()) ? { ...row, isVisible: false } : row,
);

console.log("  the header's nav after this:");
for (const row of next) {
  console.log("    " + (row.isVisible ? "shown " : "HIDDEN") + "  " + String(row.label).padEnd(14) + row.href);
}
const left = next.filter((row) => row.isVisible && String(row.href) !== "/store").length;
console.log("");
console.log("  that leaves " + left + " link(s) in the nav band beside Home.");

if (!APPLY) {
  console.log("");
  console.log("  DRY RUN — nothing written.");
  await mongoose.disconnect();
  process.exit(0);
}

const result = await stores.updateOne(
  { _id: "header" },
  { $set: { "data.nav": next, "data.updatedAt": new Date().toISOString() } },
);
console.log("");
console.log("  matched " + result.matchedCount + ", modified " + result.modifiedCount);
await mongoose.disconnect();
