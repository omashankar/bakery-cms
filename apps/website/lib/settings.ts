import { brandInfo, businessHours, contactInfo } from "@/constants/landing-data";
import {
  getActiveSocialLinks,
  getContactSettings,
  getGeneralSettings,
  isWeddingEnabled,
} from "@/features/settings/lib/settings-repository";
import { isSafeSocialUrl } from "@/features/settings/lib/settings-utils";
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

export function getStorefrontContactInfo() {
  const contact = getContactSettings();
  return {
    address: contact.address || contactInfo.address,
    phone: contact.phone || contactInfo.phone,
    email: contact.email || contactInfo.email,
    mapEmbedUrl: contact.mapEmbedUrl || contactInfo.mapEmbedUrl,
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
