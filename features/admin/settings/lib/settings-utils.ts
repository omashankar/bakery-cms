import {
  brandInfo,
  businessHours,
  contactInfo,
  socialLinks,
} from "@/constants/landing-data";
import type {
  ActivityLog,
  AnalyticsSettings,
  AppSettings,
  CommerceSettings,
  ContactSettings,
  GeneralSettings,
  MaintenanceSettings,
  SecuritySettings,
  SmtpSettings,
  SocialLinkSettings,
} from "@/types/settings";

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

export const defaultGeneralSettings: GeneralSettings = {
  siteName: brandInfo.name,
  siteTagline: brandInfo.tagline,
  siteDescription: brandInfo.description,
  logo: "/images/logo.svg",
  favicon: "/favicon.ico",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

export const defaultContactSettings: ContactSettings = {
  email: contactInfo.email,
  phone: contactInfo.phone,
  address: contactInfo.address,
  mapEmbedUrl: contactInfo.mapEmbedUrl,
  businessHours: businessHours.map((item) => ({ ...item })),
};

export const defaultSocialLinks: SocialLinkSettings[] = socialLinks.map(
  (link, index) => ({
    id: `social-${index + 1}`,
    platform: link.platform,
    href: link.href,
    label: link.label,
    isActive: true,
  })
);

export const defaultSecuritySettings: SecuritySettings = {
  sessionTimeoutMinutes: 60,
  requireStrongPasswords: true,
  twoFactorEnabled: false,
  loginNotifications: true,
  maxLoginAttempts: 5,
};

export const defaultSmtpSettings: SmtpSettings = {
  host: "smtp.example.com",
  port: 587,
  username: "noreply@monginis.com",
  password: "",
  fromEmail: "hello@monginis.com",
  fromName: brandInfo.name,
  encryption: "tls",
  enabled: false,
};

export const defaultAnalyticsSettings: AnalyticsSettings = {
  googleAnalyticsId: "",
  googleTagManagerId: "",
  facebookPixelId: "",
  hotjarId: "",
};

export const defaultMaintenanceSettings: MaintenanceSettings = {
  isEnabled: false,
  message:
    "We are currently performing scheduled maintenance. Please check back shortly.",
  allowedIps: ["127.0.0.1"],
};

export const defaultCommerceSettings: CommerceSettings = {
  deliveryFee: 99,
  freeDeliveryThreshold: 999,
  minOrderValue: 0,
  taxEnabled: true,
  taxRate: 0.05,
  taxLabel: "GST (5%)",
  taxIncludeDelivery: false,
  platformChargeEnabled: false,
  platformChargeLabel: "Platform fee",
  platformChargeAmount: 0,
  useZoneBasedDelivery: false,
  zoneFallbackDeliveryFee: 149,
  deliveryLeadDays: 1,
  estimatedDeliveryDays: 1,
  deliveryTimeSlots: [
    "10:00 AM – 12:00 PM",
    "12:00 PM – 2:00 PM",
    "2:00 PM – 4:00 PM",
    "4:00 PM – 6:00 PM",
    "6:00 PM – 8:00 PM",
  ],
  orderNumberPrefix: "BK",
  checkoutTerms:
    "By placing this order you agree to our delivery terms. Cakes are prepared fresh — cancellations within 2 hours of placement may be accepted.",
  giftWrapEnabled: true,
  giftWrapFee: 49,
  giftWrapLabel: "Gift wrap",
  paymentMethods: {
    cod: true,
    upi: true,
    card: true,
    razorpay: true,
  },
};

export const seedActivityLog: ActivityLog[] = [
  {
    id: "act-1",
    action: "published",
    entity: "homepage",
    userId: "admin",
    timestamp: daysAgo(1),
    details: "Homepage builder snapshot published",
  },
  {
    id: "act-2",
    action: "updated",
    entity: "appearance",
    userId: "admin",
    timestamp: daysAgo(2),
    details: "Theme colors and border radius updated",
  },
  {
    id: "act-3",
    action: "created",
    entity: "cake",
    entityId: "cake-12",
    userId: "admin",
    timestamp: daysAgo(3),
    details: "Added Chocolate Truffle Delight",
  },
  {
    id: "act-4",
    action: "updated",
    entity: "seo",
    userId: "admin",
    timestamp: daysAgo(4),
    details: "Global SEO defaults saved",
  },
  {
    id: "act-5",
    action: "received",
    entity: "inquiry",
    entityId: "inq-3",
    userId: "system",
    timestamp: daysAgo(5),
    details: "New wedding inquiry submitted",
  },
];

export const defaultAppSettings: AppSettings = {
  general: defaultGeneralSettings,
  contact: defaultContactSettings,
  social: defaultSocialLinks,
  security: defaultSecuritySettings,
  smtp: defaultSmtpSettings,
  analytics: defaultAnalyticsSettings,
  maintenance: defaultMaintenanceSettings,
  commerce: defaultCommerceSettings,
  activity: seedActivityLog,
  updatedAt: nowIso(),
};

export const timezoneOptions = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST)" },
  { value: "Europe/London", label: "Europe/London (GMT)" },
  { value: "America/New_York", label: "America/New_York (EST)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST)" },
  { value: "UTC", label: "UTC" },
] as const;

export const currencyOptions = [
  { value: "INR", label: "INR — Indian Rupee" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
] as const;

export const socialPlatformOptions = [
  "Instagram",
  "Facebook",
  "WhatsApp",
  "YouTube",
  "Twitter",
  "LinkedIn",
  "Pinterest",
  "TikTok",
] as const;

export const knownStorageKeys = [
  "bakery-cms-header",
  "bakery-cms-header-version",
  "bakery-cms-footer",
  "bakery-cms-footer-version",
  "bakery-cms-banners",
  "bakery-cms-banners-version",
  "bakery-cms-catalog",
  "bakery-cms-appearance",
  "bakery-cms-appearance-version",
  "bakery-cms-seo",
  "bakery-cms-seo-version",
  "bakery-cms-admin-cakes",
  "bakery-cms-media-library",
  "bakery-cms-media-library-version",
  "bakery-cms-media-folders",
  "bakery-cms-inquiries",
  "bakery-cms-newsletter-subscribers",
  "bakery-cms-testimonials",
  "bakery-cms-testimonials-version",
  "bakery-cms-faq",
  "bakery-cms-faq-version",
  "bakery-cms-pages",
  "bakery-cms-homepage-draft",
  "bakery-cms-homepage-published",
  "bakery-cms-homepage-revisions",
  "bakery-cms-homepage-version",
  "bakery-cms-wedding-draft",
  "bakery-cms-wedding-published",
  "bakery-cms-wedding-revisions",
  "bakery-cms-wedding-version",
  "bakery-cms-security-center",
  "bakery-cms-backup-history",
  "bakery-cms-delivery-zones",
  "bakery-cms-orders",
  "bakery-cms-settings",
  "bakery-cms-invoice-settings",
  "bakery-cms-email-templates",
  "bakery-cms-whatsapp-templates",
] as const;

export function createActivityEntry(
  action: string,
  entity: string,
  details?: string,
  entityId?: string
): ActivityLog {
  return {
    id: `act-${Date.now()}`,
    action,
    entity,
    entityId,
    userId: "admin",
    timestamp: nowIso(),
    details,
  };
}

export function mergeAppSettings(partial: Partial<AppSettings>): AppSettings {
  return {
    ...defaultAppSettings,
    ...partial,
    general: { ...defaultGeneralSettings, ...partial.general },
    contact: { ...defaultContactSettings, ...partial.contact },
    social: partial.social ?? defaultSocialLinks,
    security: { ...defaultSecuritySettings, ...partial.security },
    smtp: { ...defaultSmtpSettings, ...partial.smtp },
    analytics: { ...defaultAnalyticsSettings, ...partial.analytics },
    maintenance: { ...defaultMaintenanceSettings, ...partial.maintenance },
    commerce: {
      ...defaultCommerceSettings,
      ...partial.commerce,
      paymentMethods: {
        ...defaultCommerceSettings.paymentMethods,
        ...partial.commerce?.paymentMethods,
      },
      deliveryTimeSlots:
        partial.commerce?.deliveryTimeSlots ?? defaultCommerceSettings.deliveryTimeSlots,
    },
    activity: partial.activity ?? seedActivityLog,
    updatedAt: partial.updatedAt ?? nowIso(),
  };
}
