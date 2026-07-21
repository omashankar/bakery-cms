export interface ThemeSettings {
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  headingFont: string;
  borderRadius: "sm" | "md" | "lg" | "xl";
  containerWidth: "narrow" | "default" | "wide";
  headerStyle: "minimal" | "centered" | "split";
  footerStyle: "simple" | "columns" | "minimal";
  customCss?: string;
}

/**
 * Business type only changes public branding + which optional modules are shown.
 * "bakery" is the default template — the CMS behaves exactly as before for it.
 */
export type BusinessType =
  | "bakery"
  | "sweet-shop"
  | "flower-shop"
  | "restaurant"
  | "gift-shop"
  | "grocery"
  | "fashion"
  | "electronics"
  | "pharmacy"
  | "other";

export interface BusinessTypeOption {
  value: BusinessType;
  label: string;
}

export interface GeneralSettings {
  siteName: string;
  siteTagline: string;
  siteDescription: string;
  logo: string;
  favicon: string;
  timezone: string;
  currency: string;
  businessType: BusinessType;
}

export interface BusinessHoursEntry {
  day: string;
  hours: string;
}

export interface ContactSettings {
  email: string;
  phone: string;
  address: string;
  mapEmbedUrl?: string;
  businessHours: BusinessHoursEntry[];
}

export interface SocialLinkSettings {
  id: string;
  platform: string;
  href: string;
  label: string;
  isActive: boolean;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  requireStrongPasswords: boolean;
  twoFactorEnabled: boolean;
  loginNotifications: boolean;
  maxLoginAttempts: number;
}

export interface AnalyticsSettings {
  googleAnalyticsId: string;
  googleTagManagerId: string;
  facebookPixelId: string;
  hotjarId: string;
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  encryption: "tls" | "ssl" | "none";
  enabled: boolean;
}

export interface MaintenanceSettings {
  isEnabled: boolean;
  message: string;
  allowedIps: string[];
}

export interface PaymentMethodSettings {
  cod: boolean;
  upi: boolean;
  card: boolean;
  /** Online payment via Razorpay (unified UPI/Card/Netbanking/Wallet checkout). */
  razorpay: boolean;
}

export interface CommerceSettings {
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minOrderValue: number;
  taxEnabled: boolean;
  taxRate: number;
  taxLabel: string;
  taxIncludeDelivery: boolean;
  platformChargeEnabled: boolean;
  platformChargeLabel: string;
  platformChargeAmount: number;
  useZoneBasedDelivery: boolean;
  zoneFallbackDeliveryFee: number;
  deliveryLeadDays: number;
  estimatedDeliveryDays: number;
  deliveryTimeSlots: string[];
  orderNumberPrefix: string;
  checkoutTerms: string;
  giftWrapEnabled: boolean;
  giftWrapFee: number;
  giftWrapLabel: string;
  paymentMethods: PaymentMethodSettings;
}

export interface ActivityLog {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  userId: string;
  timestamp: string;
  details?: string;
}

/**
 * Optional bakery-specific modules. All ON by default (bakery template).
 * Turning one OFF hides that feature from the UI only — data/fields are never
 * deleted, so switching back ON restores everything.
 */
export interface ModuleSettings {
  weddingBuilder: boolean;
  flavour: boolean;
  eggEggless: boolean;
  weight: boolean;
  shape: boolean;
  photoCake: boolean;
}

export interface AppSettings {
  general: GeneralSettings;
  contact: ContactSettings;
  social: SocialLinkSettings[];
  security: SecuritySettings;
  smtp: SmtpSettings;
  analytics: AnalyticsSettings;
  maintenance: MaintenanceSettings;
  commerce: CommerceSettings;
  modules: ModuleSettings;
  activity: ActivityLog[];
  updatedAt: string;
}
