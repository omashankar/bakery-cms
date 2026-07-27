import { describe, expect, it } from "vitest";

import { customerMetaSchema } from "./customers.validators";

describe("customerMetaSchema", () => {
  it("accepts valid meta and lowercases the email", () => {
    const parsed = customerMetaSchema.parse({
      email: "Asha@Example.com",
      tags: ["vip", "wholesale"],
      notes: "Prefers eggless",
      marketingOptIn: true,
    });
    expect(parsed.email).toBe("asha@example.com");
    expect(parsed.blocked).toBe(false);
    expect(parsed.tags).toHaveLength(2);
  });

  it("defaults tags, notes, marketingOptIn, blocked", () => {
    const parsed = customerMetaSchema.parse({ email: "a@b.com" });
    expect(parsed.tags).toEqual([]);
    expect(parsed.notes).toBe("");
    expect(parsed.marketingOptIn).toBe(true);
    expect(parsed.blocked).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(customerMetaSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("rejects empty-string tags", () => {
    expect(customerMetaSchema.safeParse({ email: "a@b.com", tags: [""] }).success).toBe(false);
  });
});
