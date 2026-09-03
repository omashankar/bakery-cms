import { AppError, ValidationError } from "@/lib/server/http/errors";
import { connectDB } from "@/lib/server/db/mongoose";
import { CheckoutDraftModel } from "@/lib/server/db/models/checkout-draft.model";
import { OrderModel } from "@/lib/server/db/models/order.model";
import { PhotoUploadModel } from "@/lib/server/db/models/photo-upload.model";
import {
  deleteFromCloudinary,
  isCloudinaryConfigured,
  uploadToCloudinary,
} from "@/lib/server/media/cloudinary";

/**
 * The photo a customer wants printed on a photo cake.
 *
 * There was a file input on the product page that did none of this: it kept the
 * file NAME in React state and nothing else. The file was never uploaded, the
 * name never reached the cart line or the order, and the bakery received an
 * order for a photo cake with no photo and no sign that one had been chosen —
 * after the customer had watched themselves attach it, seen "Selected:
 * birthday.jpg", and paid the photo surcharge.
 *
 * This is the smallest upload path that is safe to expose. Three limits, and
 * none of them are advisory:
 */

/** 6 MB. Big enough for a phone photo, small enough not to be a storage attack. */
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * What a photo cake can actually be printed from.
 *
 * Checked by MAGIC BYTES, not by the `type` the browser reports — that field is
 * chosen by the client and an SVG or an HTML file announcing itself as
 * `image/png` would otherwise be stored and later served from the shop's own
 * media host.
 */
const SIGNATURES: { mime: string; test: (bytes: Uint8Array) => boolean }[] = [
  {
    mime: "image/jpeg",
    test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

function sniff(bytes: Uint8Array): string | null {
  return SIGNATURES.find((signature) => signature.test(bytes))?.mime ?? null;
}

/** Every refusal here is about the same field, so the shape is stated once. */
function photoError(message: string): ValidationError {
  return new ValidationError([{ field: "photo", message }], message);
}

export interface UploadedPhoto {
  url: string;
  bytes: number;
}

/**
 * Store one customer photo and return a URL the order can carry.
 *
 * `folder` keeps these out of the shop's Media library: they are one
 * customer's private photograph attached to one order, not stock the admin
 * browses and reuses.
 */
export async function uploadPhotoCakeImage(file: File): Promise<UploadedPhoto> {
  if (file.size === 0) throw photoError("That file is empty");
  if (file.size > MAX_BYTES) {
    throw photoError(
      `That photo is too large. Please use an image under ${Math.round(MAX_BYTES / (1024 * 1024))} MB.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Re-checked against the bytes we actually received, because `file.size` is
  // reported by the same client that chose the file.
  if (buffer.byteLength > MAX_BYTES) {
    throw photoError("That photo is too large.");
  }

  const mime = sniff(new Uint8Array(buffer.subarray(0, 16)));
  if (!mime) {
    throw photoError("That file is not a JPEG, PNG or WebP image.");
  }

  if (!isCloudinaryConfigured()) {
    /**
     * Refused rather than stored some other way.
     *
     * The alternative the media library falls back to is keeping the raw data
     * URI in the database — which for a 6 MB photograph means a 8 MB string on
     * an order document, sent to every admin screen that lists orders. And a
     * customer told "photo attached" whose photo lives nowhere the bakery can
     * open is the exact failure this endpoint exists to end.
     */
    throw new AppError(
      "Photo uploads are not set up on this shop yet. Please place the order and the store will contact you for the photo.",
      503,
    );
  }

  const asset = await uploadToCloudinary(
    `data:${mime};base64,${buffer.toString("base64")}`,
    "bakery-cms/photo-cakes",
  );

  await trackUpload(asset);
  /**
   * AWAITED, not fire-and-forget.
   *
   * `void sweepUnclaimedPhotos()` reads as the considerate choice and is the
   * wrong one here: on a serverless host the function can be frozen the moment
   * the response is sent, so the sweep would run sometimes, on some requests,
   * and nobody would ever notice it had stopped. A cleanup that might not happen
   * is worse than none, because the endpoint is anonymous ON THE STRENGTH of it.
   *
   * The cost is one indexed query on the overwhelming majority of uploads, since
   * there is normally nothing a day old left to sweep.
   */
  await sweepUnclaimedPhotos();

  return { url: asset.url, bytes: asset.bytes ?? buffer.byteLength };
}

/**
 * Remember the asset, so it can be deleted if nothing ever orders it.
 *
 * Called for every upload. The row is what makes the anonymous endpoint safe:
 * without it, a photo somebody chose and then changed their mind about would sit
 * in the shop's Cloudinary account forever, and abandoning an upload is the
 * ordinary case rather than the abusive one.
 */
async function trackUpload(asset: { url: string; publicId: string }): Promise<void> {
  try {
    await connectDB();
    await PhotoUploadModel.create({ publicId: asset.publicId, url: asset.url });
  } catch (error) {
    /**
     * The asset is already on Cloudinary at this point, so failing here has to
     * choose between two bad outcomes: a photo stored that nothing will ever
     * sweep, or an error for a customer whose photo actually uploaded fine.
     *
     * It takes the asset back. The row is the ONLY link from a URL to the
     * Cloudinary id, so a photo stored without one can never be deleted by
     * anything but a human going into the media console — and the endpoint is
     * open to the public on the strength of that sweep. A shop whose database
     * is unreachable cannot take the order either, so nothing is lost by
     * refusing the upload that was not lost already.
     */
    await deleteFromCloudinary(asset.publicId).catch(() => {
      console.error("[photo-upload] stored but untracked, and could not be removed", asset.publicId);
    });
    console.error("[photo-upload] could not track the upload", error);
    throw new AppError(
      "We could not attach your photo just now. Please try again in a moment.",
      503,
    );
  }
}

/**
 * THIRTY DAYS, and the number is the whole design.
 *
 * This was 24 hours, and 24 hours deletes real customers’ photographs. A CART
 * IS NOT AN ORDER: it lives in the browser’s localStorage with no expiry and no
 * timestamp, and saved-for-later lives longer still. Somebody who uploads on
 * Monday, sleeps on it, and buys on Wednesday placed an order whose photo the
 * shop had already deleted — the baker opens it and gets a 404, which is
 * verbatim the failure this module was written to end.
 *
 * The server cannot see a browser’s cart, so there is no clever signal to wait
 * for; the only honest lever is a window long enough that anything past it is
 * genuinely abandoned. Thirty days is that, and the upload budget is what keeps
 * the storage bounded rather than a short timer.
 */
const CLAIM_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Bounded, because this runs inside a customer’s upload request. */
const SWEEP_BATCH = 10;

/**
 * Delete the photos nothing has claimed in thirty days.
 *
 * Runs ON UPLOAD rather than on a schedule, because this app has no scheduler —
 * and the property that makes that acceptable is that traffic is the only thing
 * that creates work here. A shop quiet enough never to sweep is a shop quiet
 * enough not to be accumulating anything.
 *
 * A photo is claimed by an ORDER or by a CHECKOUT DRAFT — the row the server
 * writes when a customer reaches payment, which exists before the order does
 * and would otherwise leave a photo unclaimed through the exact minutes it
 * matters most. Both are asked directly rather than a flag being set on the
 * row: a flag needs a hook, and a hook that is ever missed — a COD path, a
 * retry, an import — deletes a photograph out of a real order.
 *
 * Failure is swallowed on purpose: the customer is waiting for their upload, and
 * a housekeeping error is not their problem. It is retried on the next one.
 */
async function sweepUnclaimedPhotos(): Promise<void> {
  try {
    await connectDB();
    const stale = await PhotoUploadModel.find({
      createdAt: { $lt: new Date(Date.now() - CLAIM_WINDOW_MS) },
    })
      .limit(SWEEP_BATCH)
      .lean();
    if (!stale.length) return;

    const urls = stale.map((row) => row.url);
    const claimed = new Set<string>();
    const [orders, drafts] = await Promise.all([
      OrderModel.find({ "items.photoUrl": { $in: urls } }).select("items").lean(),
      CheckoutDraftModel.find({ "items.photoUrl": { $in: urls } }).select("items").lean(),
    ]);
    for (const source of [...orders, ...drafts]) {
      for (const item of (source.items ?? []) as { photoUrl?: string }[]) {
        if (item?.photoUrl) claimed.add(item.photoUrl);
      }
    }

    for (const row of stale) {
      // A claimed photo keeps its asset and loses only the row: it belongs to an
      // order now, and nothing here should ever look at it again.
      if (!claimed.has(row.url)) await deleteFromCloudinary(row.publicId);
      await PhotoUploadModel.deleteOne({ _id: row._id });
    }
  } catch {
    /* housekeeping — the next upload tries again */
  }
}
