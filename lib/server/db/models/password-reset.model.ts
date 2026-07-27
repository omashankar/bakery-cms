import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * One-time password (OTP) for the forgot -> otp -> reset-password flow.
 * Only a hash of the code is stored. `attempts` caps brute-forcing; `usedAt`
 * marks single-use; a TTL index removes expired rows automatically.
 */
const passwordResetSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, index: true },
  otpHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
  attempts: { type: Number, default: 0 },
});

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

applyBaseTransform(passwordResetSchema, ["otpHash"]);

export type PasswordResetDoc = InferSchemaType<typeof passwordResetSchema>;

export const PasswordResetModel: Model<PasswordResetDoc> =
  (mongoose.models.PasswordReset as Model<PasswordResetDoc>) ||
  mongoose.model<PasswordResetDoc>("PasswordReset", passwordResetSchema);
