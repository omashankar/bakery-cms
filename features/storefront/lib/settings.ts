import {
  brandInfo,
  businessHours,
  contactInfo,
  socialLinks,
} from "@/constants/landing-data";
import {
  getActiveSocialLinks,
  getContactSettings,
  getGeneralSettings,
} from "@/features/admin/settings";

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

export function getStorefrontSocialLinks() {
  const active = getActiveSocialLinks();
  if (active.length === 0) {
    return socialLinks.map((link) => ({
      platform: link.platform,
      href: link.href,
      label: link.label,
    }));
  }
  return active.map((link) => ({
    platform: link.platform,
    href: link.href,
    label: link.label,
  }));
}
