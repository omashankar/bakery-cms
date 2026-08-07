import { z } from "zod";

import {
  currencyOptions,
  isSafeAssetUrl,
  isSafeSocialUrl,
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
  socialPlatformOptions,
  timezoneOptions,
} from "@/features/settings/lib/settings-utils";
import { isValidIp } from "@/features/settings/lib/maintenance-access";

/**
 * Zod contracts for each settings section. The API validates every write
 * through these — the Mongoose schema mirrors the shape, but Zod is the
 * boundary that rejects bad input before it reaches the DB.
 */

export const businessTypeEnum = z.enum([
  "bakery",
  "sweet-shop",
  "flower-shop",
  "restaurant",
  "gift-shop",
  "grocery",
  "fashion",
  "electronics",
  "pharmacy",
  "other",
]);

const nonNegative = z.number().min(0, "Must be zero or more");

/**
 * Timezone and currency are closed sets, not free text: both are fed straight to
 * `Intl`, which throws a RangeError on an unknown currency code — that would
 * take out every price on the storefront, from a settings write. The admin only
 * ever offers these, so the server accepts only these.
 */
const timezoneValues = timezoneOptions.map((option) => option.value) as [string, ...string[]];
const currencyValues = currencyOptions.map((option) => option.value) as [string, ...string[]];
const socialPlatformValues = [...socialPlatformOptions] as [string, ...string[]];

/**
 * Logo / favicon: rendered into `<img src>` and `<link rel="icon" href>`, so the
 * server refuses anything that is not empty, site-relative, or absolute http(s)
 * — see `isSafeAssetUrl`. The browser checks the same rule; this is the boundary
 * that actually enforces it.
 */
const assetUrl = z
  .string()
  .trim()
  .default("")
  .refine(isSafeAssetUrl, "Use a path like /images/logo.svg or a full https:// URL");

export const generalSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required"),
  siteTagline: z.string().trim().default(""),
  siteDescription: z.string().trim().default(""),
  logo: assetUrl,
  favicon: assetUrl,
  timezone: z.enum(timezoneValues, "Unknown timezone"),
  currency: z.enum(currencyValues, "Unknown currency"),
  businessType: businessTypeEnum,
});

export const contactSchema = z.object({
  // Trim FIRST, then decide. Written as `.trim().pipe(email).or(literal(""))`
  // the union's second branch saw the UNTRIMMED input, so a field cleared to a
  // single space was a 422 while an empty one was fine — and the browser, which
  // trims before checking, called it valid and let the admin hit Save.
  email: z
    .string()
    .trim()
    .pipe(z.literal("").or(z.email("Invalid email"))),
  phone: z.string().trim().default(""),
  address: z.string().trim().default(""),
  // Normalised first, so an API caller that pastes Google's whole `<iframe …>`
  // snippet gets the URL out of it rather than a stored blob of HTML. Then
  // https-only: this value is written straight into an `<iframe src>` on the
  // public contact page, where `javascript:` is script execution.
  mapEmbedUrl: z
    .string()
    .transform(normalizeMapEmbedUrl)
    .refine(isValidMapEmbedUrl, "Use an https:// map URL")
    .optional(),
  // Both halves required: a row with an empty day or empty hours renders as a
  // blank line in the storefront footer and on the contact page, which reads as
  // a broken site rather than as a row nobody filled in.
  businessHours: z
    .array(
      z.object({
        day: z.string().trim().min(1, "Day is required"),
        hours: z.string().trim().min(1, "Hours are required"),
      }),
    )
    .default([]),
});

export const socialSchema = z.array(
  z
    .object({
      id: z.string().trim().min(1),
      // A closed set: the footer picks its mark by platform name, so an unknown
      // one renders a placeholder that says nothing about where the link goes.
      platform: z.enum(socialPlatformValues, "Unknown social platform"),
      href: z.string().trim().default(""),
      label: z.string().trim().min(1, "Label is required"),
      isActive: z.boolean(),
    })
    // The URL rule applies to ACTIVE rows only, and that is load-bearing rather
    // than lenient. An active row is rendered into an `<a href>` in the footer of
    // EVERY storefront page — the widest untrusted-input surface in the settings,
    // and it was `z.string().trim()`, which accepts `javascript:`. An inactive row
    // is rendered nowhere.
    //
    // Requiring it unconditionally created a trap: `migrate()` repairs a stored
    // `javascript:` row by DEACTIVATING it (keeping the label so an admin can see
    // what needs fixing), which would then have produced a document the section's
    // own write path rejects forever — one row the server hid, and the whole
    // section unsaveable. Reactivating still has to pass, so nothing unsafe can
    // reach a visitor.
    .refine((link) => !link.isActive || isSafeSocialUrl(link.href), {
      path: ["href"],
      error: "An active link needs a full http(s):// profile URL",
    }),
);

/**
 * One range per field, because there were three.
 *
 * The zod bounds said 1–1440 and 1–20, the Security screen's inputs said
 * 15–480 and 3–10, and the server's clamp said 5–15 and 3–20. A shop could
 * save a value the screen offered, have the API accept it, and get something
 * else enforced — while the screen read the saved number back as though it
 * were in force.
 *
 * Exported so the page and the policy helpers use these and cannot drift.
 */
export const SECURITY_RANGES = {
  sessionTimeoutMinutes: { min: 5, max: 1440 },
  maxLoginAttempts: { min: 3, max: 20 },
} as const;

export const securitySchema = z.object({
  sessionTimeoutMinutes: z
    .number()
    .int()
    .min(SECURITY_RANGES.sessionTimeoutMinutes.min)
    .max(SECURITY_RANGES.sessionTimeoutMinutes.max),
  requireStrongPasswords: z.boolean(),
  twoFactorEnabled: z.boolean(),
  loginNotifications: z.boolean(),
  maxLoginAttempts: z
    .number()
    .int()
    .min(SECURITY_RANGES.maxLoginAttempts.min)
    .max(SECURITY_RANGES.maxLoginAttempts.max),
});

export const smtpSchema = z.object({
  host: z.string().trim().default(""),
  port: z.number().int().min(1).max(65535),
  username: z.string().trim().default(""),
  password: z.string().default(""),
  fromEmail: z.string().trim().pipe(z.email()).or(z.literal("")),
  fromName: z.string().trim().default(""),
  encryption: z.enum(["tls", "ssl", "none"]),
  enabled: z.boolean(),
});

export const analyticsSchema = z.object({
  googleAnalyticsId: z.string().trim().default(""),
  googleTagManagerId: z.string().trim().default(""),
  facebookPixelId: z.string().trim().default(""),
  hotjarId: z.string().trim().default(""),
});

export const maintenanceSchema = z.object({
  isEnabled: z.boolean(),
  // Shown to every visitor while the shop is closed, so it cannot be blank —
  // that would render the maintenance screen with an empty explanation.
  message: z.string().trim().min(1, "Visitors need to be told why the store is closed"),
  // Now enforced rather than decorative. These decide who may still reach a
  // closed shop, and an entry the server can never match against a real client
  // address is an admin believing they have access that they do not have.
  allowedIps: z
    .array(z.string().trim().refine(isValidIp, "Not a valid IP address"))
    .default([]),
});

export const commerceSchema = z.object({
  deliveryFee: nonNegative,
  freeDeliveryThreshold: nonNegative,
  minOrderValue: nonNegative,
  taxEnabled: z.boolean(),
  taxRate: z.number().min(0).max(1),
  taxLabel: z.string().default(""),
  taxIncludeDelivery: z.boolean(),
  platformChargeEnabled: z.boolean(),
  platformChargeLabel: z.string().default(""),
  platformChargeAmount: nonNegative,
  useZoneBasedDelivery: z.boolean(),
  zoneFallbackDeliveryFee: nonNegative,
  deliveryLeadDays: z.number().int().min(0),
  estimatedDeliveryDays: z.number().int().min(0),
  deliveryTimeSlots: z.array(z.string()).default([]),
  orderNumberPrefix: z.string().trim().min(1).max(8),
  checkoutTerms: z.string().default(""),
  giftWrapEnabled: z.boolean(),
  giftWrapFee: nonNegative,
  giftWrapLabel: z.string().default(""),
  paymentMethods: z.object({
    cod: z.boolean(),
    upi: z.boolean(),
    card: z.boolean(),
    razorpay: z.boolean(),
  }),
});

export const modulesSchema = z.object({
  weddingBuilder: z.boolean(),
  flavour: z.boolean(),
  eggEggless: z.boolean(),
  weight: z.boolean(),
  shape: z.boolean(),
  photoCake: z.boolean(),
});

/** Admin white-label wording overrides — all optional. */
export const labelOverridesSchema = z.object({
  collectionsTitle: z.string().trim().optional(),
  collectionsSubtitle: z.string().trim().optional(),
  productWord: z.string().trim().optional(),
  productWordPlural: z.string().trim().optional(),
});

/** section name -> its schema, used by the controller to validate PUT bodies. */
export const sectionSchemas = {
  general: generalSchema,
  contact: contactSchema,
  social: socialSchema,
  security: securitySchema,
  smtp: smtpSchema,
  analytics: analyticsSchema,
  maintenance: maintenanceSchema,
  commerce: commerceSchema,
  modules: modulesSchema,
  labelOverrides: labelOverridesSchema,
} as const;

export type SettingsSection = keyof typeof sectionSchemas;

export const SETTINGS_SECTIONS = Object.keys(sectionSchemas) as SettingsSection[];
