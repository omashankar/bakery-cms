import { brandInfo, businessHours, contactInfo } from "@/constants/landing-data";
import {
  getActiveSocialLinks,
  getContactSettings,
  getGeneralSettings,
  isWeddingEnabled,
} from "@/features/settings/lib/settings-repository";
import {
  isSafeSocialUrl,
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
} from "@/features/settings/lib/settings-utils";
import { chosen } from "./shipped-placeholder";
import { getBusinessLabels, type BusinessLabels } from "@/config/business-labels";
import type { BusinessType } from "@/types/settings";

export function getStorefrontBrandInfo() {
  const general = getGeneralSettings();
  return {
    name: general.siteName || brandInfo.name,
    tagline: general.siteTagline || brandInfo.tagline,
    description: general.siteDescription || brandInfo.description,
  };
}

/**
 * The CLIENT twin of `getStorefrontContact`, and it had the same two defects.
 *
 * `contact.phone || contactInfo.phone` reads a field the admin deliberately
 * cleared as "use the shipped demo one" — so the contact and FAQ pages
 * published `+91 1800-123-4567` as live `tel:` links for a shop that has no
 * landline. And `mapEmbedUrl` went into an `<iframe src>` with none of the
 * `normalizeMapEmbedUrl` / `isValidMapEmbedUrl` checking its server counterpart
 * does, even though that field was free text for the life of the project and
 * what is at rest can still be Google's whole `<iframe …>` snippet — or a
 * `javascript:` URL from an admin-role API call.
 */
export function getStorefrontContactInfo() {
  const contact = getContactSettings();
  const map = normalizeMapEmbedUrl(contact.mapEmbedUrl ?? "");
  return {
    address: chosen(contact.address, contactInfo.address),
    phone: chosen(contact.phone, contactInfo.phone),
    email: chosen(contact.email, contactInfo.email),
    // Undefined means "never set", which is the only case the shipped pin is
    // the right answer; a cleared or unusable value means no map.
    mapEmbedUrl:
      contact.mapEmbedUrl === undefined
        ? contactInfo.mapEmbedUrl
        : map && isValidMapEmbedUrl(map)
          ? map
          : "",
  };
}

export function getStorefrontBusinessHours() {
  const contact = getContactSettings();
  return contact.businessHours?.length ? contact.businessHours : businessHours;
}

export function getStorefrontBusinessType(): BusinessType {
  return getGeneralSettings().businessType;
}

export function getStorefrontBusinessLabels(): BusinessLabels {
  return getBusinessLabels(getStorefrontBusinessType());
}

/** Wedding cakes are bakery-only and gated by the wedding module. */
export function isStorefrontWeddingEnabled(): boolean {
  return isWeddingEnabled();
}

/**
 * The client twin of `getStorefrontChrome`'s social read. Kept in step with it
 * deliberately: no demo fallback when the shop has turned every profile off
 * (that pointed visitors at accounts the shop does not own), and every href
 * re-checked, because the schema only constrains future writes and this renders
 * into an `<a href>`.
 */
export function getStorefrontSocialLinks() {
  return getActiveSocialLinks()
    .filter((link) => isSafeSocialUrl(link.href ?? ""))
    .map((link) => ({
      platform: link.platform,
      href: link.href,
      label: link.label?.trim() || link.platform,
    }));
}
