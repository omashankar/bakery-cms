/**
 * A PHOTOGRAPH THAT WAS PASTED INTO THE DATABASE INSTEAD OF UPLOADED.
 *
 *   node --env-file=.env.local scripts/an-inlined-photograph-moves-to-the-image-host.mjs
 *   …add --apply to write.
 *
 * `ring-ceremony-special-cake` stores its main photograph as a `data:` URI:
 * 114,243 characters of base64 sitting where a URL belongs. One product is 71%
 * of the bytes of this shop's entire published catalogue, and the homepage
 * hands the whole blob to every visitor about three times — once in the
 * category rail, once in the photo-cakes rail, once in the full card list the
 * page ships to the client.
 *
 * IT CANNOT SIMPLY BE DROPPED, which is the thing that had to be checked
 * before anything was written. The product has two other images, and the
 * obvious repair — "use the next one instead" — was tried and then abandoned
 * once all three were downloaded and looked at: images[1] and images[2] are
 * stock photographs of a woman with shopping bags. The inlined one is the only
 * picture of the cake. So the bytes are not junk to be deleted; they are the
 * product's real photograph, in the wrong place.
 *
 * So it moves. Uploaded to the same Cloudinary account and folder the admin's
 * own media library uploads to, and the URL stored in its place — exactly what
 * would have happened had it gone through the upload path in the first place.
 * Nothing else about the product changes, and the photograph a customer sees
 * is the same photograph.
 *
 * HOW IT GOT THERE IS NOT A BUG, WHICH IS WHY THIS SCRIPT IS RE-RUNNABLE.
 * `uploadMedia` returns null when Cloudinary is unconfigured and the caller
 * stores the raw data URI instead — a deliberate degradation, documented in
 * `lib/server/media/cloudinary.ts`, so that a shop without credentials can
 * still add photographs. This product was created on 2026-08-25 and its other
 * two images were uploaded later, so the credentials arrived in between.
 *
 * That means the state is permanent unless something goes back for it: every
 * picture added before the credentials stays inlined forever, growing the
 * payload of every page that renders it. So this is NOT scoped to one slug and
 * not a one-off — it finds any product with an inlined image, and is worth
 * running again after a shop first configures its image host.
 */
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { mkdirSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const FOLDER = "bakery-cms";

/* Same two forms `lib/server/media/cloudinary.ts` accepts, and the same check. */
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.error("Cloudinary is not configured — nothing can be uploaded. Stopping.");
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI, {
  bufferCommands: false,
  serverSelectionTimeoutMS: 20000,
});
const db = mongoose.connection.db;
const products = db.collection("products");

console.log("db: " + db.databaseName);
console.log(APPLY ? "MODE: apply" : "MODE: dry run — nothing will be written");
console.log("");

const affected = (await products.find({}).toArray()).filter((product) =>
  (product.images ?? []).some((src) => String(src ?? "").startsWith("data:")),
);

if (affected.length === 0) {
  console.log("No product stores an inlined image. Nothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

/*
  THE SNAPSHOT IS TAKEN BEFORE THE FIRST UPLOAD, not before the first write.
  An upload that succeeds and a write that then fails leaves a file on
  Cloudinary and the document untouched, which is recoverable; losing the only
  copy of a photograph is not. The whole `images` array goes in, verbatim,
  base64 and all.
*/
mkdirSync("scripts/.snapshots", { recursive: true });
const snapshotPath = `scripts/.snapshots/inlined-images-${affected[0]._id}.json`;
writeFileSync(
  snapshotPath,
  JSON.stringify(
    affected.map((product) => ({
      _id: String(product._id),
      slug: product.slug,
      images: product.images,
    })),
    null,
    2,
  ),
);
console.log("snapshot written: " + snapshotPath);
console.log("");

for (const product of affected) {
  const images = product.images ?? [];
  console.log(`${product.slug}  (${product.status})`);

  const replacements = [];
  for (const [index, src] of images.entries()) {
    const value = String(src ?? "");
    if (!value.startsWith("data:")) {
      console.log(`  [${index}] hosted already — left alone`);
      continue;
    }

    const mime = value.slice(5, value.indexOf(";"));
    console.log(`  [${index}] inlined ${mime}, ${value.length} chars`);

    if (!APPLY) {
      console.log(`       would upload to Cloudinary /${FOLDER} and store the URL`);
      continue;
    }

    const uploaded = await cloudinary.uploader.upload(value, {
      folder: FOLDER,
      // "image", not "auto" — the same reason the app's own helper gives: auto
      // lets Cloudinary decide from the bytes and store a non-image as raw.
      resource_type: "image",
      timeout: 60000,
    });
    console.log(`       uploaded: ${uploaded.secure_url}`);
    console.log(
      `       ${uploaded.width}x${uploaded.height} ${uploaded.format}, ${uploaded.bytes} bytes`,
    );
    replacements.push({ index, url: uploaded.secure_url });
  }

  if (!APPLY || replacements.length === 0) {
    console.log("");
    continue;
  }

  const next = [...images];
  for (const { index, url } of replacements) next[index] = url;

  /*
    PINNED ON THE ARRAY IT READ. If somebody edited this product's photographs
    between the read above and this write, the filter matches nothing and the
    script says so — rather than overwriting their edit with a list built from
    a stale copy.
  */
  const result = await products.updateOne(
    { _id: product._id, images },
    { $set: { images: next, updatedAt: new Date() } },
  );

  if (result.matchedCount !== 1) {
    console.log("  NOT WRITTEN — the product changed since it was read. Re-run.");
  } else {
    const before = images.reduce((n, s) => n + String(s ?? "").length, 0);
    const after = next.reduce((n, s) => n + String(s ?? "").length, 0);
    console.log(`  written. images field: ${before} chars -> ${after} chars`);
  }
  console.log("");
}

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to upload and write.");
}

await mongoose.disconnect();
