/**
 * One-off data repair: images pasted into the database as base64.
 *
 * Run:  node --env-file=.env.local scripts/move-pasted-images-to-the-cdn.mjs
 *       node --env-file=.env.local scripts/move-pasted-images-to-the-cdn.mjs --apply
 *
 * DRY RUN unless --apply is passed. Prints every image and every place it
 * appears, and writes a snapshot of the affected documents before changing one.
 *
 * Why this exists
 * ---------------
 * A `data:image/...;base64,...` string is a whole photograph written out as
 * text, and this shop has ten of them, in forty-four places. The largest is the
 * homepage hero: three slides at ~490 KB each, held as ONE 1.4 MB JSON string,
 * and that string is stored nine times over — the draft, the published copy,
 * and the kept revisions. 11.5 MB of one document, for three pictures.
 *
 * The cost is not disk. `cmsstores` is read into the browser and cached in
 * localStorage, which is capped at about 5 MB per origin. That is the
 * QuotaExceededError this shop hit: the store outgrew the browser, and every
 * write after that threw.
 *
 * Cloudinary is already configured here, `res.cloudinary.com` is already in
 * `remoteImagePatterns`, and `uploadToCloudinary` is the same function the media
 * library and the photo-cake route use. Nothing here is new plumbing — these
 * images simply never went through it.
 *
 * How it works, and the four things a review of the first draft caught
 * -------------------------------------------------------------------
 * Every distinct image is uploaded ONCE, keyed by the SHA-256 of its bytes, and
 * every occurrence is replaced with the returned URL. The three hero images
 * appear nine times each in one document and again in the media library, so a
 * naive pass would upload the same photograph thirty times and leave thirty
 * unrelated URLs behind — which would also break the media library's usage
 * index, since `media-usage.ts` matches by exact string.
 *
 * The SHA is also the Cloudinary `public_id`, so a second run overwrites rather
 * than duplicating. That is what makes a half-finished run safe to repeat.
 *
 * 1. VERSION IS BUMPED. `cms-store.ts` refuses a save whose `expectedVersion`
 *    is stale, and that is the guard that stops one admin overwriting another.
 *    Writing the counter back unchanged would leave an open editor tab holding
 *    the pre-migration array, passing the check, and silently restoring every
 *    byte of base64 — defeating the guard with the guard's own value.
 *
 * 2. EACH DOCUMENT IS RE-READ immediately before it is rewritten. Ten uploads
 *    of up to 2.4 MB sit between the first read and the first write, and one of
 *    the affected documents is a placed order carrying a refund. `$set` writes
 *    back every field of whatever copy it holds, so a minutes-old copy would
 *    revert a status change made during the run — while leaving any newly ADDED
 *    field in place, because `$set` cannot remove one. A half-reverted order is
 *    worse than either state.
 *
 * 3. THE PAYLOAD IS CHECKED before anything is uploaded. base64 wrapped across
 *    lines would match only as far as the first newline, and the replacement
 *    would leave the tail behind — after which the "no base64 left" check at
 *    the end passes, because the marker it greps for is exactly the part that
 *    was removed. Every payload must decode whole, or the run refuses.
 *
 * 4. NON-PLAIN VALUES ARE LEFT ALONE. Rebuilding objects turns an ObjectId into
 *    a map of bytes. There are none in these three collections today — every
 *    `_id` is a string and every timestamp is an ISO string — but the guard
 *    costs one line and the next caller will not know that.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const FOLDER = "bakery-cms/rescued";
/** Beside this file, never the working directory it happens to be run from. */
const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), ".snapshots");

const TARGETS = ["cmsstores", "products", "orders"];

/**
 * A whole data URI, and nothing after it.
 *
 * base64 uses A–Z a–z 0–9 + / =, none of which can appear in the JSON that
 * surrounds it, so the match ends where the image does whether it sits in a
 * field of its own or inside a serialised string. `looksWhole` below is what
 * proves that for the data actually present, rather than assuming it.
 */
const DATA_URI = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

/**
 * Did the match capture the entire picture?
 *
 * A payload wrapped across lines, or truncated for any other reason, decodes to
 * a partial file — and the end-of-run check cannot see it, because replacing
 * the head removes the very marker it greps for. So the file has to end the way
 * its format says it ends.
 */
function looksWhole(dataUri) {
  const payload = dataUri.slice(dataUri.indexOf(",") + 1);
  if (payload.length % 4 !== 0) return false;

  const bytes = Buffer.from(payload, "base64");
  if (bytes.length === 0) return false;

  const tail = bytes.subarray(-2).toString("hex");
  const head = bytes.subarray(0, 4).toString("hex");
  if (head === "89504e47") return bytes.subarray(-8).toString("hex").endsWith("ae426082"); // PNG IEND
  if (head.startsWith("ffd8")) return tail === "ffd9"; // JPEG EOI
  // Anything else (webp, gif, svg) — the length check is all this can honestly
  // say, and it is the one that catches a line-wrapped payload.
  return true;
}

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set — run with --env-file=.env.local");

const { isCloudinaryConfigured, uploadToCloudinary } = await import(
  "../lib/server/media/cloudinary.ts"
).catch(async () => import("../lib/server/media/cloudinary.js"));

if (!isCloudinaryConfigured()) {
  throw new Error("Cloudinary is not configured — nothing to move these to.");
}

await mongoose.connect(uri);
const db = mongoose.connection.db;

const found = new Map(); // sha -> { uri, bytes, places: string[] }

function scan(node, where) {
  if (typeof node === "string") {
    for (const match of node.matchAll(DATA_URI)) {
      const value = match[0];
      const sha = createHash("sha256").update(value).digest("hex");
      const entry = found.get(sha) ?? { uri: value, bytes: value.length, places: [] };
      entry.places.push(where);
      found.set(sha, entry);
    }
    return;
  }
  if (Array.isArray(node)) return node.forEach((item, index) => scan(item, `${where}[${index}]`));
  if (node && typeof node === "object" && node.constructor === Object) {
    for (const [key, value] of Object.entries(node)) {
      if (key === "_id") continue;
      scan(value, where ? `${where}.${key}` : key);
    }
  }
}

/** Rewrite in place, leaving every value this does not understand exactly as it is. */
function rewrite(node, urlFor) {
  if (typeof node === "string") {
    if (!node.includes("data:image/")) return node;
    return node.replace(DATA_URI, (match) => {
      const sha = createHash("sha256").update(match).digest("hex");
      return urlFor.get(sha) ?? match;
    });
  }
  if (Array.isArray(node)) return node.map((item) => rewrite(item, urlFor));
  // Plain objects only. An ObjectId, a Date, a Binary or a Decimal128 rebuilt
  // key by key comes out as a map of bytes.
  if (node && typeof node === "object" && node.constructor === Object) {
    const next = {};
    for (const [key, value] of Object.entries(node)) {
      next[key] = key === "_id" ? value : rewrite(value, urlFor);
    }
    return next;
  }
  return node;
}

const affected = [];
for (const name of TARGETS) {
  for (const doc of await db.collection(name).find({}).toArray()) {
    scan(doc, "");
    if (JSON.stringify(doc).includes("data:image/")) {
      affected.push({ name, id: doc._id, label: `${name}/${doc._id}` });
    }
  }
}

const occurrences = [...found.values()].reduce((n, entry) => n + entry.places.length, 0);
const totalBytes = [...found.values()].reduce((n, entry) => n + entry.bytes * entry.places.length, 0);

console.log(`${found.size} distinct image(s), appearing ${occurrences} times`);
console.log(`${(totalBytes / 1048576).toFixed(2)} MB of base64 across ${affected.length} document(s)\n`);

const broken = [...found.entries()].filter(([, entry]) => !looksWhole(entry.uri));
for (const entry of [...found.values()].sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ${(entry.bytes / 1024).toFixed(0).padStart(5)} KB × ${entry.places.length} place(s)`);
  for (const place of entry.places.slice(0, 3)) console.log(`        ${place || "(root)"}`);
  if (entry.places.length > 3) console.log(`        … and ${entry.places.length - 3} more`);
}

if (broken.length) {
  console.log(`\nREFUSING TO RUN: ${broken.length} payload(s) did not decode to a complete image.`);
  console.log("A line-wrapped or truncated data URI would be half-replaced, and the");
  console.log("end-of-run check cannot see that. Look at these by hand:");
  for (const [sha, entry] of broken) console.log(`  ${sha.slice(0, 12)}  ${entry.places[0]}`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`\nAll ${found.size} payloads decode to a complete image.`);

if (!APPLY) {
  console.log("DRY RUN. Re-run with --apply to upload and rewrite.");
  await mongoose.disconnect();
  process.exit(0);
}

// A copy of every document about to change, before anything changes. The
// affected ones only — a whole-collection dump would carry seven customers'
// addresses into a file on disk for no reason.
mkdirSync(SNAPSHOT_DIR, { recursive: true });
const snapshot = [];
for (const { name, id } of affected) {
  snapshot.push({ collection: name, doc: await db.collection(name).findOne({ _id: id }) });
}
const stamp = snapshot.length;
writeFileSync(join(SNAPSHOT_DIR, `before-${stamp}-docs.json`), JSON.stringify(snapshot, null, 2));
console.log(`\nSnapshot of ${stamp} document(s) written to scripts/.snapshots/`);

// Upload each distinct image ONCE, under its own hash, so a repeat run
// overwrites the same asset rather than minting a second copy of it.
const urlFor = new Map();
const idFor = new Map();
let done = 0;
for (const [sha, entry] of found) {
  const asset = await uploadToCloudinary(entry.uri, FOLDER);
  urlFor.set(sha, asset.url);
  idFor.set(asset.url, asset.publicId);
  done += 1;
  console.log(`  uploaded ${done}/${found.size}  ${(entry.bytes / 1024).toFixed(0).padStart(5)} KB → ${asset.url}`);
}

console.log("");
for (const { name, id, label } of affected) {
  // RE-READ. The uploads above took minutes, and `$set` writes back every field
  // of whatever copy it is handed.
  const fresh = await db.collection(name).findOne({ _id: id });
  if (!fresh) {
    console.log(`  ${label.padEnd(34)} gone since the scan — skipped`);
    continue;
  }

  const next = rewrite(fresh, urlFor);

  /**
   * A media-library row needs its `publicId` as well as its URL.
   *
   * `media.service.ts` destroys the Cloudinary asset behind a row only when the
   * row carries one. A rewritten row without it would delist on delete and
   * leave the picture at a public URL for ever.
   */
  if (name === "cmsstores" && id === "media-files" && Array.isArray(next.data)) {
    for (const file of next.data) {
      if (file && typeof file.url === "string" && idFor.has(file.url) && !file.publicId) {
        file.publicId = idFor.get(file.url);
      }
    }
  }

  /**
   * The concurrency counter goes UP.
   *
   * Left where it was, an editor tab opened before this ran would save its
   * stale copy, pass `cms-store`'s version check, and put every byte of base64
   * straight back. Bumping it turns that into the refusal the check exists for.
   */
  if (name === "cmsstores") {
    if (typeof fresh.version === "number") next.version = fresh.version + 1;
    if (next.data && typeof next.data === "object" && typeof next.data.version === "number") {
      next.data.version = next.data.version + 1;
    }
  }

  const fields = Object.fromEntries(Object.entries(next).filter(([key]) => key !== "_id"));
  await db.collection(name).updateOne({ _id: id }, { $set: fields });

  const after = await db.collection(name).findOne({ _id: id });
  const left = (JSON.stringify(after).match(/data:image\//g) ?? []).length;
  console.log(
    `  ${label.padEnd(34)} ${(JSON.stringify(fresh).length / 1048576).toFixed(2)} MB → ` +
      `${(JSON.stringify(after).length / 1048576).toFixed(2)} MB` +
      (left ? `   ${left} STILL EMBEDDED` : ""),
  );
}

const remaining = [];
for (const name of TARGETS) {
  for (const doc of await db.collection(name).find({}).toArray()) {
    const n = (JSON.stringify(doc).match(/data:image\//g) ?? []).length;
    if (n) remaining.push(`${name}/${doc._id}: ${n}`);
  }
}
console.log(
  remaining.length
    ? `\nSTILL EMBEDDED SOMEWHERE:\n  ${remaining.join("\n  ")}`
    : "\nNo base64 image left anywhere in these collections.",
);

await mongoose.disconnect();
