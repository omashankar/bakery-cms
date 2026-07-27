import { describe, expect, it } from "vitest";

import {
  loginSchema,
  resetPasswordSchema,
  verifyOtpSchema,
  changePasswordSchema,
} from "./auth.validators";

describe("auth validators", () => {
  it("accepts a valid login and lowercases the email", () => {
    const parsed = loginSchema.parse({ email: "Admin@Bakery.com", password: "secret" });
    expect(parsed.email).toBe("admin@bakery.com");
    expect(parsed.rememberMe).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });

  it("requires a 6-digit OTP", () => {
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", otp: "123" }).success).toBe(false);
    expect(verifyOtpSchema.safeParse({ email: "a@b.com", otp: "123456" }).success).toBe(true);
  });

  it("rejects mismatched reset passwords", () => {
    const result = resetPasswordSchema.safeParse({
      email: "a@b.com",
      otp: "123456",
      password: "longenough1",
      confirmPassword: "different1",
    });
    expect(result.success).toBe(false);
  });

  it("enforces min length on new password", () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: "old",
      newPassword: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});
