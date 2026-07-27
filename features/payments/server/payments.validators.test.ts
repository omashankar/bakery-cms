import { describe, expect, it } from "vitest";

import { invoiceSettingsSchema } from "./payments.validators";

const valid = {
  companyName: "Monginis",
  tagline: "Sweet",
  logoUrl: "",
  address: "Mumbai",
  email: "hi@monginis.com",
  phone: "999",
  website: "",
  gstNumber: "GST123",
  panNumber: "",
  invoiceTitle: "Tax Invoice",
  footerNote: "",
  termsAndConditions: "",
  signatureName: "",
  signatureTitle: "",
  showLogo: true,
  showGstNumber: true,
  showPanNumber: false,
  showPaymentDetails: true,
  showDeliveryDetails: true,
  showTerms: true,
  showSignature: true,
  showOrderStatus: true,
};

describe("invoiceSettingsSchema", () => {
  it("accepts valid invoice settings", () => {
    expect(invoiceSettingsSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts an empty email", () => {
    expect(invoiceSettingsSchema.safeParse({ ...valid, email: "" }).success).toBe(true);
  });

  it("rejects a missing company name", () => {
    expect(invoiceSettingsSchema.safeParse({ ...valid, companyName: "" }).success).toBe(false);
  });

  it("rejects a missing invoice title", () => {
    expect(invoiceSettingsSchema.safeParse({ ...valid, invoiceTitle: "" }).success).toBe(false);
  });

  it("rejects a non-boolean toggle", () => {
    expect(invoiceSettingsSchema.safeParse({ ...valid, showLogo: "yes" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(invoiceSettingsSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
  });
});
