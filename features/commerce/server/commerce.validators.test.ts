import { describe, expect, it } from "vitest";

import { couponsArraySchema, deliveryZonesArraySchema } from "./commerce.validators";

const coupon = {
  id: "c1",
  code: "WELCOME10",
  label: "10% OFF",
  description: "Welcome",
  percentOff: 10,
  isActive: true,
  usageCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const zone = {
  id: "z1",
  name: "Mumbai",
  city: "Mumbai",
  pincode: "400001",
  radiusKm: 8,
  deliveryCharge: 99,
  minDeliveryDays: 0,
  estimatedDeliveryDays: 1,
  isActive: true,
  priority: 100,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("commerce validators", () => {
  it("accepts a valid coupons array", () => {
    expect(couponsArraySchema.safeParse([coupon]).success).toBe(true);
  });

  it("rejects a coupon without a code", () => {
    expect(couponsArraySchema.safeParse([{ ...coupon, code: "" }]).success).toBe(false);
  });

  it("rejects a percentOff above 100", () => {
    expect(couponsArraySchema.safeParse([{ ...coupon, percentOff: 150 }]).success).toBe(false);
  });

  it("accepts a valid delivery zones array", () => {
    expect(deliveryZonesArraySchema.safeParse([zone]).success).toBe(true);
  });

  it("rejects a zone with a negative delivery charge", () => {
    expect(deliveryZonesArraySchema.safeParse([{ ...zone, deliveryCharge: -1 }]).success).toBe(false);
  });

  it("rejects a zone without a name", () => {
    expect(deliveryZonesArraySchema.safeParse([{ ...zone, name: "" }]).success).toBe(false);
  });
});
