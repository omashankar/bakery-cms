import { businessHours, contactInfo } from "@/constants/landing-data";
import { chosenList, hoursIdentity } from "@/apps/website/lib/shipped-placeholder";
import {
  getActiveSocialLinks,
  getContactSettings,
  getGeneralSettings,
  getLabelSettings,
  isWeddingEnabled,
} from "@/features/settings/lib/settings-repository";
import {
  isSafeSocialUrl,
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
} from "@/features/settings/lib/settings-utils";
import { chosen } from "./shipped-placeholder";
import {
  getBusinessLabels,
  resolveLabels,
  type BusinessLabels,
} from "@/config/business-labels";
import type { BusinessType } from "@/types/settings";

/*
 * `getStorefrontBrandInfo` was here, and it is gone rather than merely unused.
 *
 * It read the shop's name from the CLIENT settings cache — a cache that
 * PERSISTS the shipped seed when its storage key is absent, and that a failed
 * hydration leaves alone. Its two callers were the Razorpay payment sheet and
 * the sign-in toast: a first-time visitor whose settings request was blocked
 * was shown an unfamiliar company name at the moment they entered card
 * details. `|| brandInfo.name` could not save it, because the seed it fell
 * back to is exactly what the cache had already returned.
 *
 * The server knows. Checkout takes `siteName` as a prop from
 * `getStorefrontChrome()`, and the toast no longer names the shop at all.
 * Deleted so nothing reaches for it again.
 */

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

/**
 * The shop's own opening hours, or none.
 *
 * The third site with `businessHours?.length ? … : businessHours` — the client
 * twin of the two server readers. See `chosenList`: hours nobody typed are not
 * this bakery's hours, and a customer can act on them.
 */
export function getStorefrontBusinessHours() {
  const contact = getContactSettings();
  return chosenList(contact.businessHours, businessHours, hoursIdentity);
}

export function getStorefrontBusinessType(): BusinessType {
  return getGeneralSettings().businessType;
}

export function getStorefrontBusinessLabels(): BusinessLabels {
  // The shop's own words over the preset — the same resolution the server does
  // and the admin hook does. This read the preset alone, so the collections
  // heading a shop had renamed still said "Our Collections".
  const type = getStorefrontBusinessType();
  return { ...getBusinessLabels(type), ...resolveLabels(type, getLabelSettings()) };
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
