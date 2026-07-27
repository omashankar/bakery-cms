import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes and verifies the correct password", async () => {
    const hash = await hashPassword("S3cret!pass");
    expect(hash).not.toBe("S3cret!pass");
    expect(await verifyPassword("S3cret!pass", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("S3cret!pass");
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("produces a different hash each time (salted)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
  });
});
