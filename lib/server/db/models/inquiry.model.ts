import mongoose, { type Model } from "mongoose";

import type { Inquiry } from "@/types/inquiry";

/**
 * Inquiry document. `_id` is the app's own inquiry id (string), NOT an ObjectId,
 * so existing references keep working. `type` and `status` are enums for
 * queryability; the rest are plain scalars. Inquiries are created by the public
 * contact form (POST) and managed by the admin (status/notes/delete).
 */
const inquirySchema = new mongoose.Schema(
  {
    _id: { type: String },
    type: { type: String, enum: ["wedding", "contact", "newsletter"], required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    subject: { type: String },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ["new", "in_progress", "replied", "closed"],
      default: "new",
      index: true,
    },
    notes: { type: String },
    eventDate: { type: String },
    guestCount: { type: Number },
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { minimize: false },
);

inquirySchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

export type InquiryDoc = { _id: string } & Omit<Inquiry, "id">;

export const InquiryModel: Model<InquiryDoc> =
  (mongoose.models.Inquiry as Model<InquiryDoc>) ||
  mongoose.model<InquiryDoc>("Inquiry", inquirySchema);
