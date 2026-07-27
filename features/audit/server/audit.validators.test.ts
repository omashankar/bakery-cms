import { describe, expect, it } from "vitest";

import { auditQuerySchema } from "./audit.validators";

describe("audit query validators", () => {
  it("applies defaults for page/limit when omitted", () => {
    const parsed = auditQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(50);
  });

  it("coerces page/limit strings from the URL", () => {
    const parsed = auditQuerySchema.parse({ page: "3", limit: "20" });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(20);
  });

  it("accepts optional filter fields", () => {
    const parsed = auditQuerySchema.parse({
      action: "order",
      actorEmail: "admin@bakery.com",
      targetType: "order",
      status: "success",
    });
    expect(parsed.action).toBe("order");
    expect(parsed.targetType).toBe("order");
    expect(parsed.status).toBe("success");
  });

  it("rejects an out-of-range limit", () => {
    expect(auditQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(auditQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("rejects an invalid status", () => {
    expect(auditQuerySchema.safeParse({ status: "maybe" }).success).toBe(false);
  });

  it("rejects a non-numeric page", () => {
    expect(auditQuerySchema.safeParse({ page: "abc" }).success).toBe(false);
  });
});
