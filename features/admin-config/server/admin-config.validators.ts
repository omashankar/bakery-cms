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

/**
 * Gateway runtime — enabled / mode / priority, and nothing secret.
 *
 * `credentials` is dropped rather than rejected. This blob is a whole-section
 * replace written from the browser, and an admin whose device still holds the
 * old shape would otherwise get a 400 on every gateway toggle until they cleared
 * their storage. Dropping migrates them silently, and a secret that arrives here
 * is not written down. Zod strips unknown keys by default, so this schema also
 * refuses anything else the client invents.
 */
const gatewayRuntimeSchema = z.object({
  enabled: z.boolean().optional(),
  mode: z.enum(["test", "live"]).optional(),
  priority: z.number().optional(),
});

const paymentGatewaysSchema = z.record(z.string(), gatewayRuntimeSchema);

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
