import { z } from "zod";

/**
 * Zod input contracts for auth endpoints. These are the single source of truth
 * for what the server accepts — controllers validate every body through them.
 */

const email = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email"));

/**
 * The rule the Security screen has always DESCRIBED.
 *
 * That screen says "Require 8+ chars with mixed case and numbers" next to a
 * toggle, and the rule was a bare length check — so a password of eight
 * identical letters passed while the admin read that mixed case and digits
 * were required. Stating a protection you do not apply is the failure here,
 * not the missing characters.
 *
 * Applied to the paths that SET a password — registration, reset, change —
 * and never to login, where an existing password must keep working.
 */
const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false),
});

export const forgotPasswordSchema = z.object({
  email,
});

export const verifyOtpSchema = z.object({
  email,
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const resetPasswordSchema = z
  .object({
    email,
    otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
    password: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPassword,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
