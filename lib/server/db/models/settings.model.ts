import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Store settings — a SINGLETON document (one per install), keyed by `key`.
 * Mirrors the frontend `AppSettings` shape (types/settings.ts) so the client
 * settings-repository can hydrate from / persist to the server unchanged.
 *
 * `activity` is intentionally NOT stored here — the server's audit trail lives
 * in the `audit_logs` collection. `labelOverrides` holds admin-customised
 * white-label wording layered on top of the per-business-type defaults.
 *
 * Sub-schemas use `_id: false` (embedded value objects, not documents).
 */
const sub = { _id: false } as const;

const generalSchema = new mongoose.Schema(
  {
    siteName: String,
    siteTagline: String,
    siteDescription: String,
    logo: String,
    favicon: String,
    timezone: String,
    currency: String,
    businessType: { type: String, default: "bakery" },
  },
  sub,
);

const contactSchema = new mongoose.Schema(
  {
    email: String,
    phone: String,
    address: String,
    mapEmbedUrl: String,
    businessHours: [new mongoose.Schema({ day: String, hours: String }, sub)],
  },
  sub,
);

const socialSchema = new mongoose.Schema(
  {
    id: String,
    platform: String,
    href: String,
    label: String,
    isActive: { type: Boolean, default: true },
  },
  sub,
);

const securitySchema = new mongoose.Schema(
  {
    sessionTimeoutMinutes: { type: Number, default: 60 },
    requireStrongPasswords: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    loginNotifications: { type: Boolean, default: true },
    maxLoginAttempts: { type: Number, default: 5 },
  },
  sub,
);

const smtpSchema = new mongoose.Schema(
  {
    host: String,
    port: { type: Number, default: 587 },
    username: String,
    password: String,
    fromEmail: String,
    fromName: String,
    encryption: { type: String, enum: ["tls", "ssl", "none"], default: "tls" },
    enabled: { type: Boolean, default: false },
  },
  sub,
);

const analyticsSchema = new mongoose.Schema(
  {
    googleAnalyticsId: { type: String, default: "" },
    googleTagManagerId: { type: String, default: "" },
    facebookPixelId: { type: String, default: "" },
    hotjarId: { type: String, default: "" },
  },
  sub,
);

const maintenanceSchema = new mongoose.Schema(
  {
    isEnabled: { type: Boolean, default: false },
    message: { type: String, default: "" },
    allowedIps: { type: [String], default: [] },
  },
  sub,
);

const commerceSchema = new mongoose.Schema(
  {
    deliveryFee: { type: Number, default: 0 },
    freeDeliveryThreshold: { type: Number, default: 0 },
    minOrderValue: { type: Number, default: 0 },
    taxEnabled: { type: Boolean, default: false },
    taxRate: { type: Number, default: 0 },
    taxLabel: { type: String, default: "" },
    taxIncludeDelivery: { type: Boolean, default: false },
    platformChargeEnabled: { type: Boolean, default: false },
    platformChargeLabel: { type: String, default: "" },
    platformChargeAmount: { type: Number, default: 0 },
    useZoneBasedDelivery: { type: Boolean, default: false },
    zoneFallbackDeliveryFee: { type: Number, default: 0 },
    deliveryLeadDays: { type: Number, default: 1 },
    estimatedDeliveryDays: { type: Number, default: 1 },
    deliveryTimeSlots: { type: [String], default: [] },
    orderNumberPrefix: { type: String, default: "BK" },
    checkoutTerms: { type: String, default: "" },
    giftWrapEnabled: { type: Boolean, default: false },
    giftWrapFee: { type: Number, default: 0 },
    giftWrapLabel: { type: String, default: "" },
    paymentMethods: new mongoose.Schema(
      {
        cod: { type: Boolean, default: true },
        upi: { type: Boolean, default: true },
        card: { type: Boolean, default: true },
        razorpay: { type: Boolean, default: true },
      },
      sub,
    ),
  },
  sub,
);

const modulesSchema = new mongoose.Schema(
  {
    weddingBuilder: { type: Boolean, default: true },
    flavour: { type: Boolean, default: true },
    eggEggless: { type: Boolean, default: true },
    weight: { type: Boolean, default: true },
    shape: { type: Boolean, default: true },
    photoCake: { type: Boolean, default: true },
  },
  sub,
);

const settingsSchema = new mongoose.Schema({
  // Singleton guard — always "singleton". Unique so only one doc can exist.
  key: { type: String, default: "singleton", unique: true, index: true },
  general: { type: generalSchema, default: () => ({}) },
  contact: { type: contactSchema, default: () => ({}) },
  social: { type: [socialSchema], default: [] },
  security: { type: securitySchema, default: () => ({}) },
  smtp: { type: smtpSchema, default: () => ({}) },
  analytics: { type: analyticsSchema, default: () => ({}) },
  maintenance: { type: maintenanceSchema, default: () => ({}) },
  commerce: { type: commerceSchema, default: () => ({}) },
  modules: { type: modulesSchema, default: () => ({}) },
  // Admin-customised white-label wording, e.g. { productWord: "Bouquet" }.
  labelOverrides: { type: mongoose.Schema.Types.Mixed, default: {} },
});

applyBaseTransform(settingsSchema);

export type SettingsDoc = InferSchemaType<typeof settingsSchema>;

export const SettingsModel: Model<SettingsDoc> =
  (mongoose.models.Settings as Model<SettingsDoc>) ||
  mongoose.model<SettingsDoc>("Settings", settingsSchema);
