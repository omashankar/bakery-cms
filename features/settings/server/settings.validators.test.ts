import { describe, expect, it } from "vitest";

import {
  generalSchema,
  commerceSchema,
  modulesSchema,
  contactSchema,
} from "./settings.validators";

describe("settings validators", () => {
  it("general requires a site name", () => {
    expect(
      generalSchema.safeParse({
        siteName: "",
        timezone: "Asia/Kolkata",
        currency: "INR",
      }).success,
    ).toBe(false);

    expect(
      generalSchema.safeParse({
        siteName: "My Shop",
        timezone: "Asia/Kolkata",
        currency: "INR",
      }).success,
    ).toBe(true);
  });

  it("general rejects a logo or favicon that is not safe to render", () => {
    const base = {
      siteName: "My Shop",
      timezone: "Asia/Kolkata",
      currency: "INR",
    };

    // Both fields reach an href/src attribute — the favicon a `<link rel="icon">`
    // in the root layout, the logo an `<img>` in the storefront navbar.
    expect(generalSchema.safeParse({ ...base, logo: "javascript:alert(1)" }).success).toBe(false);
    expect(generalSchema.safeParse({ ...base, favicon: "javascript:alert(1)" }).success).toBe(
      false,
    );
    // Protocol-relative: a silent off-site fetch from a field that looks like a path.
    expect(generalSchema.safeParse({ ...base, logo: "//evil.example/logo.svg" }).success).toBe(
      false,
    );

    /**
     * A data URI that is not an image is the same stored-XSS shape as
     * `javascript:` — accepting `data:` wholesale to make Upload work would have
     * reopened exactly what this test exists to close.
     */
    expect(
      generalSchema.safeParse({ ...base, logo: "data:text/html;base64,PHNjcmlwdD4=" }).success,
    ).toBe(false);

    expect(generalSchema.safeParse({ ...base, logo: "" }).success).toBe(true);
    expect(generalSchema.safeParse({ ...base, logo: "/images/logo.svg" }).success).toBe(true);

    /**
     * An uploaded logo on a shop with NO image host is a base64 image, and both
     * fields render it fine. Rejecting it disabled Save for the whole General
     * card — site name and timezone included — the moment an owner used the
     * Upload button these fields had just been given.
     */
    expect(
      generalSchema.safeParse({ ...base, logo: "data:image/png;base64,iVBORw0KGgo=" }).success,
    ).toBe(true);
    expect(
      generalSchema.safeParse({ ...base, favicon: "data:image/x-icon;base64,AAABAAEAEBA=" }).success,
    ).toBe(true);
    expect(generalSchema.safeParse({ ...base, logo: "https://cdn.example/logo.svg" }).success).toBe(
      true,
    );
  });

  it("general rejects a currency or timezone outside the supported set", () => {
    const base = {
      siteName: "My Shop",
      timezone: "Asia/Kolkata",
      currency: "INR",
    };

    // `Intl.NumberFormat` throws a RangeError on an unknown currency code, and
    // every price in the app runs through it — an unchecked write here would
    // take the storefront down.
    expect(generalSchema.safeParse({ ...base, currency: "XYZ" }).success).toBe(false);
    expect(generalSchema.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(generalSchema.safeParse({ ...base, currency: "USD" }).success).toBe(true);
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
