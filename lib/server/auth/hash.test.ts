import { describe, expect, it } from "vitest";

import { sha256, generateOtp } from "./hash";

describe("hash utils", () => {
  it("sha256 is deterministic and hex", () => {
    expect(sha256("token")).toBe(sha256("token"));
    expect(sha256("token")).toMatch(/^[a-f0-9]{64}$/);
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("generateOtp returns a 6-digit string", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtp()).toMatch(/^\d{6}$/);
    }
  });
});
