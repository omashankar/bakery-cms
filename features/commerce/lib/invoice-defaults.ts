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
  // Blank, for the same reason the GST fields below are: a plausible-looking
  // value that is not this shop’s is worse than an empty one on a document a
  // customer keeps. This was `https://bakery.demo/store`.
  website: "",
  // Blank on purpose, and this is not a placeholder waiting to be filled in.
  //
  // These were `"27AABCM1234F1Z5"` and `"AABCM1234F"` — well-formed, plausible,
  // and belonging to nobody. Combined with `invoiceTitle: "Tax Invoice"` and
  // `showGstNumber: true` below, any surface that fell back to these defaults
  // issued a customer a tax document carrying a registration number that was
  // invented. A shop that has not entered its GSTIN must print no GSTIN; that
  // is a document missing a field, which is recoverable, rather than a document
  // asserting a false one, which is not.
  gstNumber: "",
  panNumber: "",
  // "Tax Invoice" is a claim about what the document IS. It is the shop's to
  // make, once it has entered a registration number — and it can, in the
  // designer. The unconfigured default matches the Mongo model's own.
  invoiceTitle: "Invoice",
  footerNote: "Thank you for choosing us. We hope you enjoy your order.",
  // The pricing pipeline ADDS tax on top of the subtotal — `computeTaxAmount`
  // returns a separate `tax` and the total is `subtotal + … + tax`. The old
  // wording, "GST is included where applicable", told the customer the opposite
  // of what the breakdown printed directly above it.
  termsAndConditions:
    "Goods once sold will not be taken back. Cakes are perishable — please store as advised on the packaging. Taxes, where charged, are shown as a separate line above.",
  signatureName: "Store Manager",
  signatureTitle: "Authorized signatory",
  showLogo: true,
  // Off until there is a number to show. It was on, over a fabricated default.
  showGstNumber: false,
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
