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
    expect(parsed.tags).toHaveLength(2);
  });

  /**
   * It is a PATCH, not a snapshot.
   *
   * Every field carried a `.default()`, so an absent one arrived as its default
   * and was written anyway: `{ email, notes }` also stamped `tags: []`,
   * `marketingOptIn: true` and `blocked: false`. The client sent a full copy
   * built from its own cache, so two admins editing the same customer — one
   * adding a tag, one writing a note — each carried the other's field at its old
   * value and overwrote it, and both were told it saved.
   */
  it("leaves an unmentioned field absent rather than defaulting it", () => {
    const parsed = customerMetaSchema.parse({ email: "a@b.com", notes: "hi" });

    expect(parsed.notes).toBe("hi");
    expect(parsed).not.toHaveProperty("tags");
    expect(parsed).not.toHaveProperty("marketingOptIn");
    expect(parsed).not.toHaveProperty("blocked");
  });

  it("refuses a request that changes nothing", () => {
    expect(customerMetaSchema.safeParse({ email: "a@b.com" }).success).toBe(false);
  });

  it("still accepts an explicit false or empty value", () => {
    // "Not mentioned" and "set to empty" have to stay different things.
    const parsed = customerMetaSchema.parse({
      email: "a@b.com",
      notes: "",
      tags: [],
      marketingOptIn: false,
      blocked: false,
    });

    expect(parsed.notes).toBe("");
    expect(parsed.tags).toEqual([]);
    expect(parsed.marketingOptIn).toBe(false);
    expect(parsed.blocked).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(customerMetaSchema.safeParse({ email: "nope" }).success).toBe(false);
  });

  it("rejects empty-string tags", () => {
    expect(customerMetaSchema.safeParse({ email: "a@b.com", tags: [""] }).success).toBe(false);
  });
});
