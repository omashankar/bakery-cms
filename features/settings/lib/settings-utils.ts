import { z } from "zod";

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
  BusinessTypeOption,
  CommerceSettings,
  ContactSettings,
  GeneralSettings,
  MaintenanceSettings,
  ModuleSettings,
  SecuritySettings,
  SmtpSettings,
  SocialLinkSettings,
} from "@/types/settings";

function nowIso(): string {
  return new Date().toISOString();
}


export const defaultGeneralSettings: GeneralSettings = {
  siteName: brandInfo.name,
  siteTagline: brandInfo.tagline,
  siteDescription: brandInfo.description,
  // Empty, not "/images/logo.svg" — no such file was ever shipped, so the
  // default pointed at a 404. Empty means "use the header's letter mark", which
  // is what the storefront has always actually rendered.
  logo: "",
  favicon: "/favicon.ico",
  timezone: "Asia/Kolkata",
  currency: "INR",
  businessType: "bakery",
};

/** Bakery is the default template — every optional module ships ON. */
export const defaultModuleSettings: ModuleSettings = {
  weddingBuilder: true,
  flavour: true,
  eggEggless: true,
  weight: true,
  shape: true,
  photoCake: true,
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
  username: "sumanom7014106@gmail.com",
  password: "",
  // The address mail goes out AS. A relay will only send from an address it
  // has verified, so this is a starting point rather than a working config —
  // but it is one somebody owns, which the your-bakery.com placeholder was not.
  fromEmail: "sumanom7014106@gmail.com",
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
  // Empty, not `["127.0.0.1"]`. That default was seeded into every fresh
  // install, so the moment the allow-list became a real access decision it
  // meant a guessable address was pre-authorised on every deployment. An
  // allow-list starts with nobody on it.
  allowedIps: [],
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

/**
 * Empty, and it has to be.
 *
 * This shipped three fabricated rows — "Homepage builder snapshot published",
 * "Theme colors and border radius updated" — attributed to "admin" with
 * plausible timestamps. The Activity Log page MERGES them with the real server
 * audit trail and renders both identically, so a fresh shop opened its audit
 * log and read three things that never happened, indistinguishable from the
 * ones that did.
 *
 * An audit trail is worth exactly what it can be trusted for. Demo data in one
 * is not a placeholder; it is a false record. The page already handles an empty
 * list, and the real trail fills it from the first admin action.
 */
export const seedActivityLog: ActivityLog[] = [];


export const defaultAppSettings: AppSettings = {
  general: defaultGeneralSettings,
  contact: defaultContactSettings,
  social: defaultSocialLinks,
  security: defaultSecuritySettings,
  smtp: defaultSmtpSettings,
  analytics: defaultAnalyticsSettings,
  maintenance: defaultMaintenanceSettings,
  commerce: defaultCommerceSettings,
  modules: defaultModuleSettings,
  activity: seedActivityLog,
  updatedAt: nowIso(),
};

export const businessTypeOptions: BusinessTypeOption[] = [
  { value: "bakery", label: "Bakery (Default)" },
  { value: "sweet-shop", label: "Sweet Shop" },
  { value: "flower-shop", label: "Flower Shop" },
  { value: "restaurant", label: "Restaurant" },
  { value: "gift-shop", label: "Gift Shop" },
  { value: "grocery", label: "Grocery" },
  { value: "fashion", label: "Fashion" },
  { value: "electronics", label: "Electronics" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "other", label: "Other" },
];

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

/**
 * A logo / favicon reference the app may safely render.
 *
 * These two fields end up in `<img src>` and `<link rel="icon" href>`, so the
 * set of accepted values is the set of things that are safe there: empty, a
 * site-relative path, or an absolute http(s) URL. `javascript:` and `data:`
 * URLs are rejected — an admin field that reaches an href attribute is a script
 * injection point otherwise, and a protocol-relative `//host` is a silent
 * off-site fetch. Shared by the form and the Zod schema so the browser and the
 * server agree on what is valid.
 */
/**
 * The shop's OWN square icon, or "" if it is still the one this install shipped.
 *
 * `defaultGeneralSettings.favicon` is `/favicon.ico`, and the file behind it is
 * the stock Create Next App icon. It is non-empty, so an "is an icon set?" check
 * can never fail — and any surface that draws the favicon AS THE SHOP'S MARK
 * then draws that stock icon on a fresh install, which is worse than the letter
 * it replaced. The browser tab is the one place the shipped default is right, so
 * this is a question each caller asks rather than something the read decides.
 *
 * Same rule as `chosen()` on the storefront's contact fields: a value still
 * equal to the shipped one was seeded, not chosen.
 */
export function chosenFavicon(value: string | undefined): string {
  const trimmed = value?.trim() ?? "";
  return trimmed && trimmed !== defaultGeneralSettings.favicon.trim() ? trimmed : "";
}

/**
 * A base64 image, which is what an upload becomes on a shop with no image host.
 *
 * `data:image/` specifically, never bare `data:`: `data:text/html` in the same
 * slot would be a stored-XSS sink the moment one of these values reached
 * anything other than an `<img>` or a `<link rel="icon">`.
 */
const INLINE_IMAGE = /^data:image\/[a-z0-9.+-]+;base64,/i;

/**
 * What may be stored as the shop's logo or favicon.
 *
 * The `data:image/` case is not a loosening for its own sake. Both fields now
 * offer an Upload button, and on an install with no Cloudinary credentials that
 * upload legitimately produces a base64 data URI — which this function rejected,
 * so the field went red, `hasErrors` went true, and Save was disabled for the
 * WHOLE General card: the owner could no longer save their site name, timezone
 * or currency either, having done nothing but add their logo.
 *
 * Safe for these two sinks. The logo renders through an `<img>` and the favicon
 * through `<link rel="icon">`, and neither executes script from a data URI — an
 * image is a scripting-disabled context, SVG included. The SIZE is bounded
 * elsewhere, by MAX_INLINE_BYTES in the upload path.
 *
 * `javascript:` and protocol-relative `//host` stay refused, which is what this
 * guard was written for.
 */
export function isSafeAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("/")) return true;
  if (INLINE_IMAGE.test(trimmed)) return true;
  return /^https?:\/\/\S+$/i.test(trimmed);
}

/**
 * Turns whatever the admin pasted into the map field into a bare URL.
 *
 * The field is labelled "Google Maps embed URL", but Google's Share → "Embed a
 * map" tab hands you a whole `<iframe src="…" …></iframe>` snippet — so pasting
 * what Google actually gives you stored the entire HTML string as the `src` and
 * the map silently rendered blank, with nothing anywhere saying why. Accept both
 * forms and keep the URL.
 */
export function normalizeMapEmbedUrl(value: string): string {
  const trimmed = value.trim();
  if (!/<iframe/i.test(trimmed)) return trimmed;

  // Quoted or unquoted, in any case — the snippet may have been through a
  // WYSIWYG or an older Maps UI before it reaches the paste buffer.
  const src = /<iframe[^>]*\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(trimmed);
  const extracted = src?.[2] ?? src?.[3] ?? src?.[4];
  if (extracted === undefined) return trimmed;

  return decodeHtmlEntities(extracted).trim();
}

/**
 * Undoes the escaping an HTML attribute forces on a URL.
 *
 * This is not a nicety. Inside an attribute `&` is always written `&amp;`, so
 * every embed URL with more than one query parameter — OpenStreetMap's
 * `?bbox=…&amp;layer=mapnik`, the Google Maps Embed API v1's `?key=…&amp;q=…`,
 * i.e. exactly the providers the https-only rule exists to allow — unwrapped to
 * a URL whose second parameter was named `amp;layer` / `amp;q`. It passed
 * validation, stored fine, and rendered a blank map with nothing saying why:
 * the same silent failure the unwrapping was written to eliminate.
 */
function decodeHtmlEntities(value: string): string {
  // Only the entities that legitimately appear in a URL inside an attribute.
  // `&lt;`/`&gt;` are deliberately left alone: they never belong in an embed
  // URL, and decoding them would only manufacture stranger strings.
  return value
    .replace(/&(?:quot|#0*34);/g, '"')
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/&(?:amp|#0*38|#[xX]0*26);/g, "&");
}

/**
 * A map URL that is safe to put in an `<iframe src>`.
 *
 * https only. An iframe `src` executes whatever it is given, so `javascript:`
 * and `data:` here are script injection into every visitor's contact page, and
 * plain `http:` is a mixed-content frame that browsers block anyway. The host is
 * deliberately NOT restricted to Google — plenty of shops embed OpenStreetMap or
 * Mapbox, and an admin choosing who to embed is the feature.
 */
export function isValidMapEmbedUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^https:\/\/\S+$/i.test(trimmed);
}

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

export type SocialPlatform = (typeof socialPlatformOptions)[number];

/**
 * A social profile link that is safe to put in the footer's `<a href>`.
 *
 * That anchor is on EVERY page of the storefront, so this field is the widest
 * untrusted-input surface in the settings: a `javascript:` URL here is script
 * execution site-wide, not on one page. http(s) only — `mailto:` and `tel:`
 * belong to the Contact section, which renders them itself.
 */
export function isSafeSocialUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^https?:\/\/\S+$/i.test(trimmed);
}

/**
 * A stable id for a new social row.
 *
 * `social-${Date.now()}` collided: two rows added inside the same millisecond —
 * which is what happens when "Add link" is clicked twice, or held — shared an
 * id, and `updateLink` matches on it, so editing one edited both. They also
 * collided as React keys.
 */
export function createSocialLinkId(): string {
  const unique =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  return `social-${unique}`;
}

/**
 * The @handle inside an Instagram profile URL, if there is one.
 *
 * `https://instagram.com/sweetcrumb` and `https://www.instagram.com/sweetcrumb/`
 * both give "sweetcrumb"; the bare `https://instagram.com` gives "". Used to
 * label the homepage's Instagram section from the profile the admin already
 * configured under Social settings, instead of a hardcoded demo handle.
 */
export function instagramHandleFromUrl(url: string): string {
  const match = /^https?:\/\/(?:[\w-]+\.)*instagram\.com\/+([^/?#\s]+)/i.exec(url.trim());
  const handle = match?.[1] ?? "";
  // `p`, `reel` and `explore` are Instagram's own routes, not accounts.
  return ["p", "reel", "reels", "explore", "accounts"].includes(handle.toLowerCase())
    ? ""
    : handle.replace(/^@/, "");
}

/** One correction to a stored settings document, as a path and the value to set. */
export interface SettingsRepair {
  path: string;
  value: unknown;
  reason: string;
}

/**
 * Decides what to repair in a settings document written before the current
 * contracts existed. Pure, so the rules can be tested without a database — this
 * is the only logic in the app that REWRITES data at rest, which makes it the
 * last place to leave untested.
 *
 * Tightening a Zod schema only constrains future writes, and the Mongoose model
 * stores these fields as bare `String`. So:
 *
 * - `contact.mapEmbedUrl` may hold Google's whole `<iframe …>` snippet (the
 *   paste that field invites) or a `javascript:` URL. Unwrap what can be
 *   unwrapped, drop what cannot.
 * - `social[].href` may hold a `javascript:` URL, and an active row is rendered
 *   into an `<a href>` in the footer of every storefront page. DEACTIVATE rather
 *   than delete or blank: the row keeps its label and platform, so the admin can
 *   see what needs a real URL instead of finding a link silently gone.
 */
export function planSettingsRepairs(settings: {
  contact?: { mapEmbedUrl?: string };
  social?: { href?: string; isActive?: boolean }[];
}): SettingsRepair[] {
  const repairs: SettingsRepair[] = [];

  const storedMap = settings.contact?.mapEmbedUrl ?? "";
  if (storedMap) {
    const normalized = normalizeMapEmbedUrl(storedMap);
    const repaired = isValidMapEmbedUrl(normalized) ? normalized : "";
    if (repaired !== storedMap) {
      repairs.push({
        path: "contact.mapEmbedUrl",
        value: repaired,
        reason: repaired ? "unwrapped" : "dropped as unsafe",
      });
    }
  }

  if (Array.isArray(settings.social)) {
    settings.social.forEach((link, index) => {
      // An already-hidden row is not rendered anywhere, so there is nothing to
      // repair — and rewriting it would churn the document on every read.
      if (link?.isActive === false) return;
      if (isSafeSocialUrl(link?.href ?? "")) return;
      repairs.push({
        path: `social.${index}.isActive`,
        value: false,
        reason: `social[${index}] hidden (unsafe href)`,
      });
    });
  }

  return repairs;
}

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
    modules: { ...defaultModuleSettings, ...partial.modules },
    activity: partial.activity ?? seedActivityLog,
    updatedAt: partial.updatedAt ?? nowIso(),
  };
}

/**
 * The ONE email rule, shared by the form and the schema.
 *
 * The Contact form restated it as a regex "deliberately matching what Zod's
 * `z.email()` accepts" — and it did not, in either direction. `o'brien@bakery.ie`
 * is a legal address that Zod takes and the regex refused, so the field showed
 * "Enter a valid email address", Save stayed disabled for the WHOLE Contact
 * section, and the shop could not change its address, phone or opening hours
 * either until the owner used a different email.
 *
 * Restating a rule is how the two drift. `isSafeAssetUrl`, `isValidMapEmbedUrl`
 * and `isSafeSocialUrl` are already shared between the form and the schema for
 * exactly this reason; this is the fourth.
 */
const emailRule = z.email();

export function isValidEmailAddress(value: string): boolean {
  return emailRule.safeParse(value.trim()).success;
}
