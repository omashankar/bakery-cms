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

/**
 * One saved address: the checkout's address fields plus the book's own four.
 *
 * Strip, not passthrough — anything else a browser sends is dropped rather
 * than stored on the account. Every string is length-capped, because this is
 * written by the customer's browser and read back into checkout.
 */
const savedAddressSchema = z.object({
  id: z.string().trim().min(1).max(80),
  label: z.string().trim().max(40).default("Home"),
  isDefault: z.boolean().default(false),
  createdAt: z.string().trim().max(40),
  updatedAt: z.string().trim().max(40),
  fullName: z.string().trim().max(120).default(""),
  email: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(32).default(""),
  addressLine1: z.string().trim().max(200).default(""),
  addressLine2: z.string().trim().max(200).optional(),
  landmark: z.string().trim().max(200).optional(),
  city: z.string().trim().max(80).default(""),
  state: z.string().trim().max(80).default(""),
  pincode: z.string().trim().max(12).default(""),
  country: z.string().trim().max(80).optional(),
  altPhone: z.string().trim().max(32).optional(),
  addressLabel: z.enum(["Home", "Office", "Other"]).optional(),
});

/** The whole book, replaced in one write. Twenty is more than anyone keeps. */
export const savedAddressesSchema = z.object({
  addresses: z.array(savedAddressSchema).max(20, "You can save up to 20 addresses"),
});

export type SavedAddressRecord = z.infer<typeof savedAddressSchema>;
export type RequestCodeInput = z.infer<typeof requestCodeSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
