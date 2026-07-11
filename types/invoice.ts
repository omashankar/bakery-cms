export interface InvoiceSettings {
  companyName: string;
  tagline: string;
  logoUrl: string;
  address: string;
  email: string;
  phone: string;
  website: string;
  gstNumber: string;
  panNumber: string;
  invoiceTitle: string;
  footerNote: string;
  termsAndConditions: string;
  signatureName: string;
  signatureTitle: string;
  showLogo: boolean;
  showGstNumber: boolean;
  showPanNumber: boolean;
  showPaymentDetails: boolean;
  showDeliveryDetails: boolean;
  showTerms: boolean;
  showSignature: boolean;
  showOrderStatus: boolean;
  updatedAt: string;
}

export type InvoiceSettingsFormData = Omit<InvoiceSettings, "updatedAt">;
