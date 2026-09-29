import { cache } from "react";

import { getSettings } from "@/features/settings/server/settings.service";
import { getPublicZones } from "@/features/commerce/server/commerce.service";
import {
  getStorefrontCategories,
  getStorefrontCollections,
  getStorefrontOccasions,
} from "./storefront-categories.server";
import { resolveLabels, type ResolvedLabels } from "@/config/business-labels";
import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";
import { defaultHeaderSettings, selectVisibleNavItems } from "@/features/site-layout/lib/header-utils";
import { resolveNavMenus } from "@/features/site-layout/lib/menu-links";
import { offeredAxes } from "@/features/catalog/lib/catalog-utils";
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
  /** The shop's own categories, for the header's Shop menu. */
  categories: { id: string; name: string; slug: string; image?: string }[];
  /** The shop's own occasions, for the same menu's second column. */
  occasions: { id: string; name: string; slug: string }[];
  /**
   * The shop's CURATED groups, for the same menu's THIRD column.
   *
   * The catalogue separated three concepts — what a thing IS, what it is FOR,
   * and which group somebody deliberately put it in — each with its own
   * address, status and order. The header carried two of them, so the one
   * axis a shop assembles BY HAND was the one its menu could not show.
   *
   * FREE. `getCatalog` is `cache()`d and the two reads above already take it,
   * so this is a third caller of one memoised document, not a third round
   * trip.
   *
   * NAME AND SLUG ONLY, never the stored row — see the projection below.
   */
  collections: { id: string; name: string; slug: string }[];
  /**
   * THE NOUNS THE MENU HEADS ITS COLUMNS WITH.
   *
   * They were hardcoded English — "Shop by Category" over a column a phone
   * shop calls Brands — in a CMS whose admin has carried `categoryWord`,
   * `occasionWord` and `collectionWord` for a while now. A shop filing under
   * Brands read Brands in its admin and "Shop by Category" on its own site.
   *
   * A SERVER field and not `useBusinessLabels`: that hook seeds the neutral
   * defaults and layers the shop's own in a `useEffect`, so the HTML would
   * carry the default and the browser would swap it one paint later. The
   * panel is `invisible` until hover, so nobody would ever SEE that flash —
   * which is exactly why it would never be caught.
   *
   * FOUR of the eleven, not all of them: this rides on every route.
   */
  menuWords: Pick<
    ResolvedLabels,
    "productWordPlural" | "categoryWord" | "occasionWord" | "collectionWord"
  >;
  /** General settings logo URL. Empty means "render the letter mark instead". */
  logo: string;
  logoLetter: string;
  showSearch: boolean;
  /** The shop's own line for the search box; blank means the generic one. */
  searchPlaceholder: string;
  /** Draw the promo strip above the header at all. */
  showBannerStrip: boolean;
  /*
    GONE, AT THE SHOP'S REQUEST: the header's call-to-action button, the thin
    row above the bar, and the currency note that was the only thing in it.

    The button was live — "Order Inquiry", beside the cart — and the row read
    "Currency · INR". Neither is offered any more and neither can be turned
    back on: the switches are off the Header screen, the fields are off
    `HeaderSettings`, and the schema drops them on every save.

    The promo strip above them STAYS. It carries this shop's two live offers,
    and the homepage's banner-grid section draws a different list, so removing
    it would have taken them off the site altogether.
  */
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
  /**
   * Has the shop configured ANY active delivery zone?
   *
   * The header's delivery-location control checks a PIN code against the
   * shop's own zones. With no zones the only answer it could ever give is
   * that nothing covers you — which is the difference between "we do not
   * deliver there" and "nobody has said yet", and a shop that takes that
   * order by phone would be called a liar by its own header. So the control
   * does not mount.
   *
   * A boolean, not the list: this is read on every storefront page, and the
   * zones themselves are fetched when the panel opens.
   */
  hasDeliveryZones: boolean;
}

/**
 * Whether the shop has any delivery zone switched on.
 *
 * `getPublicZones` already filters to active ones. Its own failure is
 * answered with false, which hides the control — the same rule the rest of
 * this file follows for a read it could not make: show nothing rather than
 * something that might not be true.
 */
async function hasActiveDeliveryZones(): Promise<boolean> {
  try {
    return (await getPublicZones()).length > 0;
  } catch {
    return false;
  }
}

/** The navbar badge falls back to the shop's initial rather than a seeded letter. */
function firstLetterOf(siteName: string): string {
  return siteName.trim().charAt(0).toUpperCase();
}

/**
 * The four the header draws, projected in ONE place.
 *
 * Through a helper rather than four literals twice over, so the happy path
 * and the database-unreachable path cannot drift — the same argument
 * `getServerLabels` makes for going through `resolveLabels` on its own
 * failure branch.
 */
function menuWordsFrom(labels: ResolvedLabels): StorefrontChrome["menuWords"] {
  return {
    productWordPlural: labels.productWordPlural,
    categoryWord: labels.categoryWord,
    occasionWord: labels.occasionWord,
    collectionWord: labels.collectionWord,
  };
}

function fallbackChrome(): StorefrontChrome {
  return {
    siteName: brandInfo.name,
    // The settings read failed. EMPTY, not the demo taxonomy: this is the
    // database-unreachable path, and a menu of links into a catalogue we
    // cannot read is a menu of links to empty grids.
    categories: [],
    // Same rule: with no way to read the zones there is nothing to check a
    // PIN code against, so the control does not appear.
    hasDeliveryZones: false,
    occasions: [],
    // Same rule as the two lists above: a menu into a catalogue we cannot
    // read is a menu of links to empty grids.
    collections: [],
    // Neutral wording, never blank. An empty noun renders a bare "Shop by"
    // over the one row this path still draws.
    menuWords: menuWordsFrom(resolveLabels()),
    logo: "",
    logoLetter: firstLetterOf(brandInfo.name),
    showSearch: defaultHeaderSettings.showSearch,
    showBannerStrip: defaultHeaderSettings.showBannerStrip ?? true,
    searchPlaceholder: "",
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

/**
 * Built at most ONCE per request.
 *
 * This runs several times over on a single storefront render — the layout
 * needs it for the navbar and footer, and `/store/contact` and the 404 page
 * ask for it again on top of that — and every run re-read the header, the
 * footer and the appearance palette. Measured on `/store`: nine cms-store
 * round trips for three documents that cannot change mid-render.
 *
 * A pure read, so there is nothing to keep consistent with a write: the admin
 * saves these through `replaceSiteLayout`, which never comes through here.
 */
export const getStorefrontChrome = cache(async (): Promise<StorefrontChrome> => {
  try {
    // Concurrently with the rest. The categories read was added as a serial
    // `await` further down, which put a whole extra round trip on the critical
    // path of every storefront render for a value the others do not depend on.
    const [
      settingsRaw,
      headerRaw,
      footerRaw,
      appearanceRaw,
      categories,
      occasions,
      collectionRows,
      hasDeliveryZones,
    ] =
      await Promise.all([
        getSettings(),
        getSiteLayout("header"),
        getSiteLayout("footer"),
        getSiteLayout("appearance"),
        getStorefrontCategories(),
        // In the SAME Promise.all — the note above records what a serial
        // await here cost the critical path of every storefront render.
        getStorefrontOccasions(),
        // And the third axis, in the SAME round trip. `getCatalog` is
        // `cache()`d and the two calls above have already taken it, so three
        // concurrent callers are one document read — which is the whole
        // reason a third column costs nothing on the checkout page.
        getStorefrontCollections(),
        // And this one too, for the same reason.
        hasActiveDeliveryZones(),
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

    /*
      ALREADY RESOLVED. `getSettings` runs `withLabels`, which is
      `resolveLabels(labelOverrides, businessType)` — so this is a field on a
      value already in hand, not a second settings read and not a call to
      `getServerLabels`. `resolveLabels()` covers only a settings document so
      old it predates the field.
    */
    const labels = (settings.labels as ResolvedLabels | undefined) ?? resolveLabels();

    /*
      WHAT THE SHOP IS ACTUALLY OFFERING, across all three axes at once.

      A GROUP WITH NOTHING IN IT is a link to an empty grid, answered from
      `productIds.length` without reading a single product — the line that
      keeps the catalogue off the checkout page.

      AND A CATEGORY WHOSE ADDRESS A COLLECTION HAS TAKEN is not offered.
      Both live at /store/collections/<slug> and the route resolves
      COLLECTION first — collections/[slug]/page.tsx does it in the page and
      repeats it in `generateMetadata`, so the title and the grid cannot
      describe different things. At a shared slug the category row would be a
      link that opens somebody else's page under the category's name.

      THROUGH THE SHARED RULE and not two filters written here, because the
      admin screen where a shop PICKS a link has to ask the same question.
      Three filters that live server-side only are three ways for that screen
      to offer something this object then drops — a link that looks saved and
      never appears.
    */
    const offered = offeredAxes({
      categories,
      occasions,
      collections: collectionRows,
    });

    /*
      The three lists a picked menu link may point into.

      Built from `offered` rather than from the raw reads, so the resolver
      cannot bring back a row this very object is not allowed to show. No unit
      test on the pure resolver can catch that wiring being wrong, which is
      why it is one expression here rather than three arguments at the call
      site.
    */
    const menuAxes = {
      category: offered.categories,
      occasion: offered.occasions,
      collection: offered.collections,
    };

    return {
      siteName: name,
      // The General settings logo, finally rendered somewhere: it was stored,
      // validated and read only by the invoice designer, so setting it changed
      // nothing a customer ever saw.
      logo: (general.logo ?? "").trim(),
      // Derived from the shop's own name when it has not chosen a letter. The
      // seed used to supply one, so a shop that never opened Appearance wore
      // another brand's initial; `defaultHeaderSettings.logoLetter` is now ""
      // precisely so this falls through to the name.
      logoLetter: header.logoLetter?.trim() || firstLetterOf(name),
      showSearch: header.showSearch ?? defaultHeaderSettings.showSearch,
      searchPlaceholder: (header.searchPlaceholder ?? "").trim(),
      showBannerStrip:
        header.showBannerStrip ?? defaultHeaderSettings.showBannerStrip ?? true,
      /*
        RESOLVED FIRST, then filtered for visibility.

        A link the shop PICKED carries which catalogue row it is; the label
        and the address are rebuilt from the live row here, and a link whose
        row is gone is dropped. A link the shop TYPED is returned untouched,
        which is every link stored before today.

        There is one row of links now: the second row above the logo went at
        the shop's request, and the CTA button beside the cart with it.
      */
      navItems: selectVisibleNavItems(resolveNavMenus(header.nav ?? [], menuAxes)),
      /**
       * The shop's own categories, for the header's Shop menu.
       *
       * That menu rendered `shopMegaMenu.categories` from constants — the
       * shipped demo taxonomy — on every storefront page. A category the shop
       * deleted still had a link (to an empty grid) and one it created never
       * appeared, so the header and the collections page below it described two
       * different shops. The collections pills were moved onto the real
       * taxonomy already; this is the other half of that fix.
       */
      categories: offered.categories,
      occasions: offered.occasions,
      /*
        PROJECTED, never spread. `getStorefrontCollections` returns each row
        whole — `description`, `image` and every member id — and this object
        crosses the RSC wire into a client navbar on every storefront and
        /account route, cart and checkout among them. Two groups here is
        seven ids; one 500-product collection would be 500 ids in the
        checkout payload to render a name. The categories reader next door
        hand-picks its fields; this one does not, so the projection has to
        happen here.
      */
      collections: offered.collections.map(({ id, name: groupName, slug }) => ({
        id,
        name: groupName,
        slug,
      })),
      menuWords: menuWordsFrom(labels),
      hasDeliveryZones,
      brand: {
        name,
        /*
          `chosen`, NOT `||`, and for the reason the address and the hours
          below already use it.

          `defaultGeneralSettings` is CREATED holding these two strings, so
          the fallback was never reached and never needed to be: the stored
          value WAS the shipped sentence. Every shop that had not rewritten
          the box published "Freshly baked cakes, pastries and confections,
          made to order." under its own logo — including the florists and
          gift shops `businessType: "other"` exists to serve.

          Empty now, which is the honest state for a shop that has not said
          anything about itself yet. The footer already draws nothing for a
          blank one.
        */
        tagline: chosen(general.siteTagline, brandInfo.tagline),
        description: chosen(general.siteDescription, brandInfo.description),
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
});
