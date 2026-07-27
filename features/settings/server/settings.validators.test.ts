import { describe, expect, it } from "vitest";

import {
  generalSchema,
  commerceSchema,
  modulesSchema,
  contactSchema,
  businessTypeEnum,
} from "./settings.validators";

describe("settings validators", () => {
  it("accepts every supported business type", () => {
    for (const type of businessTypeEnum.options) {
      expect(businessTypeEnum.safeParse(type).success).toBe(true);
    }
    expect(businessTypeEnum.safeParse("spaceship").success).toBe(false);
  });

  it("general requires a site name and valid business type", () => {
    expect(
      generalSchema.safeParse({
        siteName: "",
        timezone: "Asia/Kolkata",
        currency: "INR",
        businessType: "bakery",
      }).success,
    ).toBe(false);

    expect(
      generalSchema.safeParse({
        siteName: "My Shop",
        timezone: "Asia/Kolkata",
        currency: "INR",
        businessType: "flower-shop",
      }).success,
    ).toBe(true);
  });

  it("commerce rejects a tax rate above 1 (100%)", () => {
    const base = {
      deliveryFee: 0,
      freeDeliveryThreshold: 0,
      minOrderValue: 0,
      taxEnabled: true,
      taxRate: 1.5,
      taxLabel: "GST",
      taxIncludeDelivery: false,
      platformChargeEnabled: false,
      platformChargeLabel: "",
      platformChargeAmount: 0,
      useZoneBasedDelivery: false,
      zoneFallbackDeliveryFee: 0,
      deliveryLeadDays: 1,
      estimatedDeliveryDays: 1,
      deliveryTimeSlots: [],
      orderNumberPrefix: "BK",
      checkoutTerms: "",
      giftWrapEnabled: false,
      giftWrapFee: 0,
      giftWrapLabel: "",
      paymentMethods: { cod: true, upi: true, card: true, razorpay: true },
    };
    expect(commerceSchema.safeParse(base).success).toBe(false);
    expect(commerceSchema.safeParse({ ...base, taxRate: 0.05 }).success).toBe(true);
  });

  it("modules requires all six booleans", () => {
    expect(
      modulesSchema.safeParse({
        weddingBuilder: true,
        flavour: true,
        eggEggless: true,
        weight: true,
        shape: true,
        photoCake: true,
      }).success,
    ).toBe(true);
    expect(modulesSchema.safeParse({ weddingBuilder: true }).success).toBe(false);
  });

  it("contact allows an empty email", () => {
    expect(
      contactSchema.safeParse({ email: "", phone: "", address: "", businessHours: [] }).success,
    ).toBe(true);
  });
});
