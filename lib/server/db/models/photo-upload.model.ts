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
 * The TTL is a BACKSTOP, not the mechanism. It removes the row and cannot touch
 * Cloudinary, so a row it reaps leaves the asset behind — which is the right way
 * round: the sweep runs first and does the real work, and this only stops the
 * collection growing without bound on a shop so quiet that no upload ever
 * triggers one.
 *
 * It sits WELL BEYOND the sweep’s own thirty-day window, because a TTL that
 * fired first would delete the row while the photo it points at is still in
 * somebody’s cart — and once the row is gone there is nothing left that can
 * ever delete the asset.
 */
const photoUploadSchema = new mongoose.Schema({
  /** Cloudinary's id — what `deleteFromCloudinary` needs. */
  publicId: { type: String, required: true, index: true },
  /** What the cart line and the order carry, and so what a claim matches on. */
  url: { type: String, required: true, index: true },
  // No `index: true` here. It generates `createdAt_1`, which is the SAME name
  // the TTL declaration below generates — Mongo keeps the first and silently
  // ignores the second, so the backstop this model spends a paragraph on was
  // never actually created. One declaration, and it is the one with the TTL.
  createdAt: { type: Date, default: () => new Date() },
});

photoUploadSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

applyBaseTransform(photoUploadSchema);

export type PhotoUploadDoc = InferSchemaType<typeof photoUploadSchema>;

export const PhotoUploadModel: Model<PhotoUploadDoc> =
  (mongoose.models.PhotoUpload as Model<PhotoUploadDoc>) ||
  mongoose.model<PhotoUploadDoc>("PhotoUpload", photoUploadSchema);
