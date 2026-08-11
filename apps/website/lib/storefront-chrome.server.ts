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
import {
  appearanceCssVariables,
  defaultAppearanceSettings,
} from "@/features/site-layout/lib/appearance-tokens";
import type { AppearanceSettings } from "@/types/appearance";
import { chosen, chosenList, hoursIdentity } from "./shipped-placeholder";

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
  /**
   * The header's call-to-action button.
   *
   * The admin screen has had a whole card for this — a switch, a label and a
   * link — since before this type existed, and none of the three ever
   * travelled: `StorefrontChrome` had no field and the navbar rendered no
   * button. The screen said so twice, in the summary line and in the card's
   * own helper text ("Order inquiry button on desktop").
   */
  cta: { show: boolean; label: string; href: string };
  navItems: HeaderNavItem[];
  brand: { name: string; tagline: string; description: string };
  contact: { address: string; phone: string; email: string };
  businessHours: { day: string; hours: string }[];
  socialLinks: { platform: string; href: string; label: string }[];
  footer: FooterSettings;
  /**
   * The shop palette as CSS custom properties, for the FIRST paint.
   *
   * Nothing server-rendered these, so every visitor was painted the hardcoded
   * defaults in globals.css until a client fetch resolved and repainted. Those
   * defaults are byte-identical to the demo preset, so a shop on defaults saw
   * nothing wrong — and a shop with its own colours showed every visitor the
   * demo brown first, on every cold load. The comment at the top of this file
   * already claimed this problem was solved for the header and footer.
   *
   * Empty when the stored palette is unusable, which leaves the CSS defaults
   * standing rather than writing half a theme.
   */
  appearance: Record<string, string>;
}

function fallbackChrome(): StorefrontChrome {
  return {
    siteName: brandInfo.name,
    logo: "",
    logoLetter: defaultHeaderSettings.logoLetter,
    showSearch: defaultHeaderSettings.showSearch,
    cta: {
      show: defaultHeaderSettings.showCta,
      label: defaultHeaderSettings.ctaLabel,
      href: defaultHeaderSettings.ctaHref,
    },
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
    // Nothing, so the stylesheet defaults stand. Writing the demo palette
    // here would paint a database outage as a deliberate rebrand.
    appearance: {},
  };
}

export async function getStorefrontChrome(): Promise<StorefrontChrome> {
  try {
    const [settingsRaw, headerRaw, footerRaw, appearanceRaw] = await Promise.all([
      getSettings(),
      getSiteLayout("header"),
      getSiteLayout("footer"),
      getSiteLayout("appearance"),
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
    /**
     * Merged field by field, not substituted whole.
     *
     * `?? default` only helps when the ENTIRE record is missing. A record
     * stored before a field existed has it `undefined`, and the admin form
     * merges defaults over that while this did not — so the same shop saw a
     * block switched ON in the editor and hidden on its own site.
     */
    const header: HeaderSettings = {
      ...defaultHeaderSettings,
      ...((headerRaw ?? {}) as Partial<HeaderSettings>),
    };
    const footer: FooterSettings = {
      ...defaultFooterSettings,
      ...((footerRaw ?? {}) as Partial<FooterSettings>),
    };

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
      cta: {
        show: header.showCta ?? defaultHeaderSettings.showCta,
        // An empty label would render a button with no accessible name.
        label: header.ctaLabel?.trim() || defaultHeaderSettings.ctaLabel,
        href: header.ctaHref?.trim() || defaultHeaderSettings.ctaHref,
      },
      navItems: selectVisibleNavItems(header.nav ?? []),
      brand: {
        name,
        tagline: general.siteTagline || brandInfo.tagline,
        description: general.siteDescription || brandInfo.description,
      },
      // The same rule the social block ten lines below already follows, and for
      // the same reason. Deactivating every social link is a deliberate "we are
      // not on social"; clearing the address is a deliberate "we do not publish
      // one". Answering the first with instagram.com was called out as pointing
      // visitors at accounts the shop does not own — answering the second with
      // `|| defaultContact.address` put "123 Baker Street, Mumbai" in the
      // footer of EVERY storefront page of a bakery in Delhi, next to a phone
      // number nobody can answer. `fallbackChrome()` keeps the defaults, and
      // should: that is the database-unreachable path.
      contact: {
        address: chosen(contact.address, defaultContact.address),
        phone: chosen(contact.phone, defaultContact.phone),
        email: chosen(contact.email, defaultContact.email),
      },
      // See storefront-contact.server.ts: the footer published the shipped
      // demo hours as this shop's own in exactly the same way.
      businessHours: chosenList(contact.businessHours, defaultHours, hoursIdentity),
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
      /**
       * Re-checked at READ time, because the schema only constrains future
       * writes. `landing-footer` does `column.links.map(...)` unguarded and
       * renders INSIDE the storefront shell — outside this try/catch — so a
       * column stored without `links` threw on every storefront route, and
       * the admin's own footer screen died on the same value.
       */
      footer: {
        ...footer,
        columns: (Array.isArray(footer.columns) ? footer.columns : []).map((column) => ({
          ...column,
          links: Array.isArray(column?.links) ? column.links : [],
        })),
      },
      // Re-derived from the stored value rather than trusted: the schema
      // only constrains future writes, so a row at rest can hold a colour
      // that was allowed in years earlier. `appearanceCssVariables` returns
      // nothing for a palette it cannot use.
      appearance: appearanceCssVariables(
        { ...defaultAppearanceSettings, ...((appearanceRaw ?? {}) as Partial<AppearanceSettings>) },
        { forceSemantics: true },
      ),
    };
  } catch {
    return fallbackChrome();
  }
}
