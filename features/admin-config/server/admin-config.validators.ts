import { z } from "zod";

/**
 * Admin-only singleton config blobs. Lenient schemas — these are free-form
 * key/value stores read back by the admin UI, so we validate the outer shape
 * and pass the rest through.
 */

const adminProfileSchema = z
  .object({
    fullName: z.string().optional(),
    mobile: z.string().optional(),
    username: z.string().optional(),
    photoUrl: z.string().optional(),
    createdAt: z.string().optional(),
    lastLogin: z.string().optional(),
  })
  .passthrough();

const paymentGatewaysSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

const paymentNotifPrefsSchema = z.record(z.string(), z.record(z.string(), z.unknown()));

const customCodeSchema = z
  .object({
    css: z.string().default(""),
    js: z.string().default(""),
  })
  .passthrough();

export const adminConfigSchemas = {
  "admin-profile": adminProfileSchema,
  "payment-gateways": paymentGatewaysSchema,
  "payment-notif-prefs": paymentNotifPrefsSchema,
  "custom-code": customCodeSchema,
} as const;
