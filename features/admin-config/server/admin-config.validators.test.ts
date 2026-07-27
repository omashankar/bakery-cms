import { describe, expect, it } from "vitest";

import { adminConfigSchemas } from "./admin-config.validators";

describe("admin-config validators", () => {
  it("accepts a custom-code blob", () => {
    expect(
      adminConfigSchemas["custom-code"].safeParse({ css: ".x{}", js: "console.log(1)" }).success,
    ).toBe(true);
  });

  it("defaults custom-code fields to empty strings", () => {
    const parsed = adminConfigSchemas["custom-code"].parse({});
    expect(parsed.css).toBe("");
    expect(parsed.js).toBe("");
  });

  it("accepts an admin-profile blob (passthrough)", () => {
    expect(
      adminConfigSchemas["admin-profile"].safeParse({
        fullName: "Owner",
        mobile: "999",
        extra: "kept",
      }).success,
    ).toBe(true);
  });

  it("accepts a payment-gateways record of gateway configs", () => {
    expect(
      adminConfigSchemas["payment-gateways"].safeParse({
        razorpay: { mode: "test", priority: 1 },
        stripe: { enabled: false },
      }).success,
    ).toBe(true);
  });

  it("accepts a payment-notif-prefs record", () => {
    expect(
      adminConfigSchemas["payment-notif-prefs"].safeParse({
        "order-placed": { enabled: true, channels: ["in_app"] },
      }).success,
    ).toBe(true);
  });
});
