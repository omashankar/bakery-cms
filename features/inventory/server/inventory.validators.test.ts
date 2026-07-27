import { describe, expect, it } from "vitest";

import {
  adjustStockSchema,
  setUnlimitedSchema,
  inventorySettingsSchema,
} from "./inventory.validators";

describe("inventory validators", () => {
  it("accepts a valid adjustment and defaults the reason", () => {
    const parsed = adjustStockSchema.parse({ cakeId: "p1", type: "add", quantity: 5 });
    expect(parsed.reason).toBe("manual_adjustment");
    expect(parsed.type).toBe("add");
  });

  it("rejects a negative quantity", () => {
    expect(adjustStockSchema.safeParse({ cakeId: "p1", type: "set", quantity: -1 }).success).toBe(false);
  });

  it("rejects an unknown adjustment type", () => {
    expect(adjustStockSchema.safeParse({ cakeId: "p1", type: "double", quantity: 1 }).success).toBe(false);
  });

  it("requires a cakeId", () => {
    expect(adjustStockSchema.safeParse({ cakeId: "", type: "add", quantity: 1 }).success).toBe(false);
  });

  it("validates set-unlimited input", () => {
    expect(setUnlimitedSchema.safeParse({ cakeId: "p1", unlimited: true }).success).toBe(true);
    expect(setUnlimitedSchema.safeParse({ cakeId: "p1", unlimited: "yes" }).success).toBe(false);
  });

  it("validates inventory settings", () => {
    expect(
      inventorySettingsSchema.safeParse({ defaultLowStockThreshold: 10, trackStockHistory: true }).success,
    ).toBe(true);
    expect(
      inventorySettingsSchema.safeParse({ defaultLowStockThreshold: -5, trackStockHistory: true }).success,
    ).toBe(false);
  });
});
