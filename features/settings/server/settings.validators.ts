import { z } from "zod";

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

export const generalSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required"),
  siteTagline: z.string().trim().default(""),
  siteDescription: z.string().trim().default(""),
  logo: z.string().trim().default(""),
  favicon: z.string().trim().default(""),
  timezone: z.string().trim().min(1),
  currency: z.string().trim().min(1),
  businessType: businessTypeEnum,
});

export const contactSchema = z.object({
  email: z.string().trim().pipe(z.email("Invalid email")).or(z.literal("")),
  phone: z.string().trim().default(""),
  address: z.string().trim().default(""),
  mapEmbedUrl: z.string().trim().optional(),
  businessHours: z
    .array(z.object({ day: z.string(), hours: z.string() }))
    .default([]),
});

export const socialSchema = z.array(
  z.object({
    id: z.string(),
    platform: z.string(),
    href: z.string().trim(),
    label: z.string(),
    isActive: z.boolean(),
  }),
);

export const securitySchema = z.object({
  sessionTimeoutMinutes: z.number().int().min(1).max(1440),
  requireStrongPasswords: z.boolean(),
  twoFactorEnabled: z.boolean(),
  loginNotifications: z.boolean(),
  maxLoginAttempts: z.number().int().min(1).max(20),
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
  message: z.string().default(""),
  allowedIps: z.array(z.string()).default([]),
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
