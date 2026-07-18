import { brandInfo, contactInfo } from "@/constants/landing-data";
import type { InvoiceSettings } from "@/types/invoice";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultInvoiceSettings: InvoiceSettings = {
  companyName: brandInfo.name,
  tagline: brandInfo.tagline,
  logoUrl: "/images/logo.svg",
  address: contactInfo.address,
  email: contactInfo.email,
  phone: contactInfo.phone,
  website: "https://bakery.demo/store",
  gstNumber: "27AABCM1234F1Z5",
  panNumber: "AABCM1234F",
  invoiceTitle: "Tax Invoice",
  footerNote: "Thank you for choosing us. We hope your celebration is as sweet as our cakes.",
  termsAndConditions:
    "Goods once sold will not be taken back. Cakes are perishable — please store as advised on the packaging. GST is included where applicable.",
  signatureName: "Store Manager",
  signatureTitle: "Authorized signatory",
  showLogo: true,
  showGstNumber: true,
  showPanNumber: false,
  showPaymentDetails: true,
  showDeliveryDetails: true,
  showTerms: true,
  showSignature: true,
  showOrderStatus: true,
  updatedAt: nowIso(),
};

export function mergeInvoiceSettings(
  partial: Partial<InvoiceSettings> | null | undefined
): InvoiceSettings {
  return {
    ...defaultInvoiceSettings,
    ...partial,
    updatedAt: partial?.updatedAt ?? defaultInvoiceSettings.updatedAt,
  };
}
