import { z } from "zod";

/**
 * What the storefront's sign-in endpoints accept.
 *
 * The email is lowercased HERE, once, because it is the account key and the
 * order key. A capitalised address that reached the database unchanged would be
 * a second account for the same person, holding none of their orders.
 */
const email = z.string().trim().toLowerCase().pipe(z.email("Please enter a valid email"));

export const requestCodeSchema = z.object({
  email,
  /**
   * Optional, and only used when the account does not exist yet. A returning
   * customer's stored name is not overwritten by whatever was typed into the
   * sign-in box.
   */
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
});

export const verifyCodeSchema = z.object({
  email,
  // Exactly six digits: anything else is a typo or a probe, and neither should
  // reach the hash comparison or burn one of the five attempts.
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const updateCustomerProfileSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  phone: z.string().trim().max(32).optional(),
});

export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
