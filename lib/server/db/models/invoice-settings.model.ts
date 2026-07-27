import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Invoice settings — a SINGLETON document. Company identity + which sections to
 * render on generated invoices. Validated by Zod on write.
 */
const invoiceSettingsSchema = new mongoose.Schema({
  key: { type: String, default: "singleton", unique: true, index: true },
  companyName: { type: String, default: "" },
  tagline: { type: String, default: "" },
  logoUrl: { type: String, default: "" },
  address: { type: String, default: "" },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  website: { type: String, default: "" },
  gstNumber: { type: String, default: "" },
  panNumber: { type: String, default: "" },
  invoiceTitle: { type: String, default: "Invoice" },
  footerNote: { type: String, default: "" },
  termsAndConditions: { type: String, default: "" },
  signatureName: { type: String, default: "" },
  signatureTitle: { type: String, default: "" },
  showLogo: { type: Boolean, default: true },
  showGstNumber: { type: Boolean, default: true },
  showPanNumber: { type: Boolean, default: false },
  showPaymentDetails: { type: Boolean, default: true },
  showDeliveryDetails: { type: Boolean, default: true },
  showTerms: { type: Boolean, default: true },
  showSignature: { type: Boolean, default: true },
  showOrderStatus: { type: Boolean, default: true },
});

applyBaseTransform(invoiceSettingsSchema);

export type InvoiceSettingsDoc = InferSchemaType<typeof invoiceSettingsSchema>;

export const InvoiceSettingsModel: Model<InvoiceSettingsDoc> =
  (mongoose.models.InvoiceSettings as Model<InvoiceSettingsDoc>) ||
  mongoose.model<InvoiceSettingsDoc>("InvoiceSettings", invoiceSettingsSchema);
