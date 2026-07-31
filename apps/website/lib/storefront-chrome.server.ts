import { getSettings } from "@/features/settings/server/settings.service";
import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";
import { defaultHeaderSettings, selectVisibleNavItems } from "@/features/site-layout/lib/header-utils";
import { defaultFooterSettings } from "@/features/site-layout/lib/footer-utils";
import {
  brandInfo,
  businessHours as defaultHours,
  contactInfo as defaultContact,
} from "@/constants/landing-data";
import { isSafeSocialUrl } from "@/features/settings/lib/settings-utils";
import type { HeaderNavItem, HeaderSettings, FooterSettings } from "@/types/site-layout";

/**
 * The "chrome" (navbar + footer) data for the storefront, read on the SERVER
 * from MongoDB. This is what lets the header/footer render the admin's real
 * store name, nav, contact and footer in the HTML — instead of shipping defaults
 * and swapping them in after hydration (a flash + wrong SEO).
 */
export interface StorefrontChrome {
  siteName: string;
  /** General settings logo URL. Empty means "render the letter mark instead". */
  logo: string;
  logoLetter: string;
  showSearch: boolean;
  navItems: HeaderNavItem[];
  brand: { name: string; tagline: string; description: string };
  contact: { address: string; phone: string; email: string };
  businessHours: { day: string; hours: string }[];
  socialLinks: { platform: string; href: string; label: string }[];
  footer: FooterSettings;
}

function fallbackChrome(): StorefrontChrome {
  return {
    siteName: brandInfo.name,
    logo: "",
    logoLetter: defaultHeaderSettings.logoLetter,
    showSearch: defaultHeaderSettings.showSearch,
    navItems: selectVisibleNavItems(defaultHeaderSettings.nav),
    brand: { name: brandInfo.name, tagline: brandInfo.tagline, description: brandInfo.description },
    contact: {
      address: defaultContact.address,
      phone: defaultContact.phone,
      email: defaultContact.email,
    },
    businessHours: defaultHours,
    // Empty, not the demo profiles. This is the database-unreachable path, and
    // rendering instagram.com/facebook.com as the shop's own accounts is worse
    // than rendering no social row: the rest of the fallback is generic filler,
    // but these would be live links to somebody else's profiles.
    socialLinks: [],
    footer: defaultFooterSettings,
  };
}

export async function getStorefrontChrome(): Promise<StorefrontChrome> {
  try {
    const [settingsRaw, headerRaw, footerRaw] = await Promise.all([
      getSettings(),
      getSiteLayout("header"),
      getSiteLayout("footer"),
    ]);

    const settings = settingsRaw as unknown as Record<string, unknown>;
    const general = (settings.general ?? {}) as Record<string, string | undefined>;
    const contact = (settings.contact ?? {}) as {
      address?: string;
      phone?: string;
      email?: string;
      businessHours?: { day: string; hours: string }[];
    };
    const social = (Array.isArray(settings.social) ? settings.social : []) as {
      platform: string;
      href: string;
      label: string;
      isActive?: boolean;
    }[];
    const header = (headerRaw as unknown as HeaderSettings) ?? defaultHeaderSettings;
    const footer = (footerRaw as unknown as FooterSettings) ?? defaultFooterSettings;

    const activeSocial = social.filter((s) => s.isActive);
    const name = general.siteName || brandInfo.name;

    return {
      siteName: name,
      // The General settings logo, finally rendered somewhere: it was stored,
      // validated and read only by the invoice designer, so setting it changed
      // nothing a customer ever saw.
      logo: (general.logo ?? "").trim(),
      logoLetter: header.logoLetter || defaultHeaderSettings.logoLetter,
      showSearch: header.showSearch ?? defaultHeaderSettings.showSearch,
      navItems: selectVisibleNavItems(header.nav ?? []),
      brand: {
        name,
        tagline: general.siteTagline || brandInfo.tagline,
        description: general.siteDescription || brandInfo.description,
      },
      contact: {
        address: contact.address || defaultContact.address,
        phone: contact.phone || defaultContact.phone,
        email: contact.email || defaultContact.email,
      },
      businessHours: contact.businessHours?.length ? contact.businessHours : defaultHours,
      // No fallback to the demo profiles. Deactivating every link is a
      // deliberate "we are not on social", and answering that with
      // instagram.com/facebook.com pointed visitors at accounts the shop does
      // not own. Each surviving href is re-checked because the schema only
      // constrains future writes — see `isSafeSocialUrl`.
      socialLinks: activeSocial
        .filter((s) => isSafeSocialUrl(s.href ?? ""))
        .map((s) => ({
          platform: s.platform,
          href: s.href,
          // The anchor renders an icon and nothing else, so this is its entire
          // accessible name. `label` is only required for future writes, so a
          // row at rest can still be missing one — falling back to the platform
          // keeps the link announceable instead of unnamed.
          label: s.label?.trim() || s.platform,
        })),
      footer,
    };
  } catch {
    return fallbackChrome();
  }
}
