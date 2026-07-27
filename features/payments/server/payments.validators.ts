import { z } from "zod";

/** Zod contract for invoice settings (InvoiceSettingsFormData). */

const str = z.string().default("");
const bool = z.boolean();

export const invoiceSettingsSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  tagline: str,
  logoUrl: str,
  address: str,
  email: z.string().trim().pipe(z.email()).or(z.literal("")),
  phone: str,
  website: str,
  gstNumber: str,
  panNumber: str,
  invoiceTitle: z.string().trim().min(1, "Invoice title is required"),
  footerNote: str,
  termsAndConditions: str,
  signatureName: str,
  signatureTitle: str,
  showLogo: bool,
  showGstNumber: bool,
  showPanNumber: bool,
  showPaymentDetails: bool,
  showDeliveryDetails: bool,
  showTerms: bool,
  showSignature: bool,
  showOrderStatus: bool,
});

export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;
