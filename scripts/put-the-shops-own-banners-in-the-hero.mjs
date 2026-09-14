/**
 * The shop draws its own hero banners. This puts them on the homepage.
 *
 * Run:  node --env-file=.env.local scripts/put-the-shops-own-banners-in-the-hero.mjs
 *       node --env-file=.env.local scripts/put-the-shops-own-banners-in-the-hero.mjs --apply
 *
 * Reads every `banners/banner-*.png` named in SLIDES below, uploads each to
 * Cloudinary, and REPLACES the hero section's slides with them — in `draft`
 * and in `published` — with `layout: "banner"`. Replaces, not appends: the
 * folder is the list, so a banner dropped from it is dropped from the page.
 *
 * WHY THE SLIDES END UP WITH NO WORDS IN THEM.
 *
 * Each of these is a designed graphic: the headline, the line under it and the
 * Order Now button are all drawn INTO the picture. Typing the same words into
 * the CMS fields as well would render them a second time, laid over the artwork
 * that already says them. So `headline`, `subtext`, `badge` and the button
 * labels stay empty, which is also what makes `HeroBannerSlideView` treat the
 * whole picture as one link.
 *
 * WHICH MAKES `imageAlt` THE ONLY COPY OF THOSE WORDS ANYTHING CAN READ. It is
 * a transcription of what each banner says — not a description invented here —
 * because for a screen reader it is the banner.
 *
 * NOT RUN BY THE SCRIPT, and worth knowing before publishing:
 *
 *   - Only the first slide's link is specific. It says "Birthday" in as many
 *     words and the shop has that category; the rest name festivals this shop
 *     has no category for, so they go to the whole collections page rather
 *     than to a guess that lands on an empty grid. Change them in the builder.
 *   - There is no phone-sized version of any of these. The band takes its
 *     height from the artwork, so a 4.8:1 banner on a 390px screen is an 81px
 *     strip and the type drawn into it is small. `mobileImageUrl` is a field
 *     on every slide for a picture composed for that box.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

const APPLY = process.argv.includes("--apply");

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
  console.log("FAIL: Cloudinary is not configured in this env file");
  process.exit(1);
}

/**
 * `imageAlt` is a TRANSCRIPTION of the words drawn into each picture.
 *
 * Read off the artwork itself, in the order a sighted reader meets them, and
 * ending with the button so somebody using a screen reader knows the whole
 * thing is a link. Nothing here is a claim this script made up: every sentence
 * is already on the banner the shop drew.
 */
const SLIDES = [
  {
    file: "banner-1.png",
    alt: "Freshly baked and delivered the same day. Make Their Birthday Sweeter. Order now.",
    href: "/store/collections/birthday",
  },
  {
    file: "banner-2.png",
    alt: "Celebrate Ganesh Chaturthi with Divine Gifts. Sweets, hampers, pooja essentials, same-day delivery. Order now.",
    href: "/store/collections",
  },
  {
    file: "banner-3.png",
    alt: "Ganpati Bappa Morya. Festive Gifts and Sweets — modaks, gift hampers, pooja essentials. Order now.",
    href: "/store/collections",
  },
];

/**
 * THE FOLDER AND THE LIST ABOVE MUST AGREE, exactly.
 *
 * The alt text is a transcription of the words drawn into each picture, so it
 * cannot be derived from the file — it has to be written per banner, by hand,
 * after looking at it. Which means a file in the folder that nobody has
 * described would be published with no description, and an entry here whose
 * file has been renamed would publish the WRONG description against whatever
 * took its place.
 *
 * Both are silent. Neither is allowed.
 */
function checkTheFolderMatches(names) {
  const listed = SLIDES.map((slide) => slide.file).sort();
  const found = names.filter((name) => /^banner-.*\.png$/i.test(name)).sort();

  const undescribed = found.filter((name) => !listed.includes(name));
  const missing = listed.filter((name) => !found.includes(name));

  if (undescribed.length || missing.length) {
    for (const name of undescribed) {
      console.log(`FAIL: ${name} is in banners/ with no description written for it`);
    }
    for (const name of missing) {
      console.log(`FAIL: ${name} has a description here but is not in banners/`);
    }
    console.log(
      `\nLook at each new banner and add it to SLIDES in ${"scripts/put-the-shops-own-banners-in-the-hero.mjs"},` +
        "\nwith its words transcribed. Nothing was uploaded.",
    );
    process.exit(1);
  }
}

const ROOT = process.cwd();

console.log(APPLY ? "=== APPLYING ===" : "=== DRY RUN — pass --apply to write ===\n");

checkTheFolderMatches(await readdir(path.join(ROOT, "banners")));

/** Read and measure first, so a wrong-shaped file is caught before anything uploads. */
const prepared = [];
for (const slide of SLIDES) {
  const file = path.join(ROOT, "banners", slide.file);
  let bytes;
  try {
    bytes = await readFile(file);
  } catch {
    console.log(`FAIL: cannot read ${slide.file}`);
    process.exit(1);
  }
  if (bytes.slice(1, 4).toString() !== "PNG") {
    console.log(`FAIL: ${slide.file} is not a PNG`);
    process.exit(1);
  }
  // PNG IHDR: width and height are big-endian at byte 16 and 20.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const ratio = width / height;
  console.log(`${slide.file}  ${width} x ${height}  (${ratio.toFixed(2)}:1)  ${(bytes.length / 1024).toFixed(0)} KB`);
  /*
    NOTHING IS CROPPED ANY MORE — the band takes its height from the picture,
    so any ratio renders whole. What these warn about is the consequence of
    that: a squarer banner is a TALLER band, and a very tall one is clamped
    and letterboxed rather than being allowed to fill the screen.

    Warnings, not refusals. It is the shop's artwork.
  */
  if (ratio < 1.5) {
    console.log(
      `  WARNING: nearly square — the band will be about as tall as the page is wide,`,
    );
    console.log(`           and anything past 0.75x that is letterboxed.`);
  }
  if (ratio > 3.2) {
    console.log(
      `  WARNING: very wide — on a 390px phone this is a ${Math.round(390 / ratio)}px strip,`,
    );
    console.log(`           so any type drawn into it will be small. Consider a phone version.`);
  }
  if (width < 1400) {
    console.log(`  WARNING: narrower than most desktops — it will be scaled up and look soft.`);
  }
  prepared.push({ ...slide, bytes, width, height });
}

if (!APPLY) {
  console.log(
    `\nWould upload ${prepared.length} file(s) and REPLACE the hero's slides in draft and published.`,
  );
  console.log("Dry run — nothing uploaded, nothing written. Re-run with --apply.");
  process.exit(0);
}

console.log("\n--- uploading ---");
for (const slide of prepared) {
  const dataUri = `data:image/png;base64,${slide.bytes.toString("base64")}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "bakery-cms/hero",
    resource_type: "image",
    timeout: 60000,
  });
  slide.url = result.secure_url;
  console.log(`  ${slide.file} -> ${result.secure_url}`);
}

await mongoose.connect(process.env.MONGODB_URI, { bufferCommands: false });
const db = mongoose.connection.db;
console.log(`\ndb: ${db.databaseName}`);

const stores = db.collection("cmsstores");
const doc = await stores.findOne({ _id: "homepage-sections" });
const version = doc?.data?.version;
if (typeof version !== "number") {
  console.log(`FAIL: data.version is ${JSON.stringify(version)}`);
  await mongoose.disconnect();
  process.exit(1);
}
console.log(`data.version = ${version} (the write is pinned to it)`);

const next = JSON.parse(JSON.stringify(doc.data));

/*
  REPLACING, not appending — so say what goes.

  The pictures these point at stay on the CDN; nothing here deletes them, and
  an orphaned asset is cheaper than a deletion that turns out to have been the
  one the shop wanted back.
*/
const replacing = JSON.parse(
  next.published.sections.find((s) => s.type === "hero")?.content?.slides ?? "[]",
);
if (replacing.length) {
  console.log(`\nreplacing ${replacing.length} slide(s) already on the homepage:`);
  for (const [index, slide] of replacing.entries()) {
    console.log(`  [${index}] ${String(slide.imageUrl ?? "").slice(-28)}`);
  }
}

const slideContent = prepared.map((slide) => ({
  // Blank, deliberately: the words are drawn into the picture. See the note at
  // the top of this file.
  badge: "",
  headline: "",
  subtext: "",
  primaryLabel: "",
  primaryHref: slide.href,
  secondaryLabel: "",
  secondaryHref: "",
  imageUrl: slide.url,
  imageAlt: slide.alt,
}));

for (const which of ["draft", "published"]) {
  const hero = next[which].sections.find((s) => s.type === "hero");
  if (!hero) {
    console.log(`FAIL: no hero row in ${which}`);
    await mongoose.disconnect();
    process.exit(1);
  }
  hero.content.slides = JSON.stringify(slideContent);
  hero.content.layout = "banner";
  console.log(`SET   ${which}/hero  ${slideContent.length} slides, layout = "banner"`);
}

next.version = version + 1;
next.draft.updatedAt = new Date().toISOString();
next.published.updatedAt = next.draft.updatedAt;

const result = await stores.updateOne(
  { _id: "homepage-sections", "data.version": version },
  { $set: { data: next } },
);

if (result.modifiedCount !== 1) {
  console.log(
    `FAIL: wrote ${result.modifiedCount} document(s). Somebody published while this ran — ` +
      "nothing was changed, and the uploads above are simply unused. Re-run it.",
  );
  await mongoose.disconnect();
  process.exit(1);
}

const after = await stores.findOne({ _id: "homepage-sections" });
let wrong = 0;
for (const which of ["draft", "published"]) {
  const hero = after.data[which].sections.find((s) => s.type === "hero");
  if (hero?.content?.layout !== "banner") {
    console.log(`READBACK: ${which}/hero.layout = ${JSON.stringify(hero?.content?.layout)}`);
    wrong += 1;
  }
  const stored = JSON.parse(hero?.content?.slides ?? "[]");
  if (stored.length !== prepared.length) {
    console.log(
      `READBACK: ${which}/hero has ${stored.length} slide(s), expected ${prepared.length}`,
    );
    wrong += 1;
  }
  for (const [index, slide] of stored.entries()) {
    if (!slide.imageUrl?.startsWith("https://")) {
      console.log(`READBACK: ${which}/hero slide ${index} has no image URL`);
      wrong += 1;
    }
    if (!slide.imageAlt) {
      console.log(`READBACK: ${which}/hero slide ${index} has no description`);
      wrong += 1;
    }
    if (slide.headline) {
      console.log(`READBACK: ${which}/hero slide ${index} has a headline that would double up`);
      wrong += 1;
    }
  }
}

console.log(
  `\nwrote. data.version ${version} -> ${after.data.version}. readback mismatches: ${wrong}`,
);
await mongoose.disconnect();
process.exit(wrong ? 1 : 0);
