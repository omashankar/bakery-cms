import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * One customer photo, tracked from the moment it is stored until an order
 * claims it or it is swept.
 *
 * The upload endpoint takes no sign-in, so this is what keeps that safe: a photo
 * nobody ordered is deleted a day later. It is not only an abuse control —
 * abandoning an upload is the ORDINARY case, because people change their mind
 * about which picture goes on the cake, and every one of those used to sit in
 * the shop's Cloudinary account for good.
 *
 * `publicId` is the point of the row. The URL is what the order carries, but
 * deleting the asset needs the id, and once the row is gone there is no way back
 * from one to the other.
 *
 * The TTL is a BACKSTOP at thirty days, not the mechanism. It removes the row
 * and cannot touch Cloudinary, so a row it reaps leaves the asset behind — which
 * is the right way round: the sweep runs first and does the real work, and this
 * only stops the collection growing without bound on a shop so quiet that no
 * upload ever triggers one.
 */
const photoUploadSchema = new mongoose.Schema({
  /** Cloudinary's id — what `deleteFromCloudinary` needs. */
  publicId: { type: String, required: true, index: true },
  /** What the cart line and the order carry, and so what a claim matches on. */
  url: { type: String, required: true, index: true },
  createdAt: { type: Date, default: () => new Date(), index: true },
});

photoUploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

applyBaseTransform(photoUploadSchema);

export type PhotoUploadDoc = InferSchemaType<typeof photoUploadSchema>;

export const PhotoUploadModel: Model<PhotoUploadDoc> =
  (mongoose.models.PhotoUpload as Model<PhotoUploadDoc>) ||
  mongoose.model<PhotoUploadDoc>("PhotoUpload", photoUploadSchema);
