import { z } from "zod";

/**
 * Zod input contracts for auth endpoints. These are the single source of truth
 * for what the server accepts — controllers validate every body through them.
 */

const email = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email"));

/**
 * The rule, and every sentence describing it, in step.
 *
 * This was a bare length check under a screen promising mixed case and
 * numbers, so eight identical letters passed while the admin read that more
 * was required — stating a protection you do not apply. It then briefly
 * required an uppercase letter, which nothing on the reset screen mentioned.
 *
 * It is now letters and numbers, at least eight of them, which is what the
 * reset card and the Security screen both say. Case is not required: an
 * uppercase rule buys very little against a long password and costs a real
 * person a failed reset when they are already locked out.
 *
 * Applied to the paths that SET a password — registration, reset, change —
 * and never to login, where an existing password must keep working.
 */
const strongPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password is too long")
  .regex(/[a-zA-Z]/, "Include a letter")
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
