import { getCatalog } from "@/features/catalog/server/catalog.service";
import { getHomepageState } from "@/features/cms-sections/data/homepage-sections.server";
import {
  storefrontHomeFrom,
  type StorefrontHome,
} from "@/features/cms-sections/lib/storefront-home";
import { storefrontMenuFrom, type StorefrontMenuCatalog } from "@/features/cms-sections/lib/storefront-menu";
import { getSiteLayout } from "@/features/site-layout/server/site-layout.service";
import type { HeaderSettings } from "@/types/site-layout";
import { getHomepageRails, getProducts } from "@/features/products/data/products-service";
import { getSettings } from "@/features/settings/server/settings.service";
import { supportedLocaleOf } from "@/features/settings/server/site-identity.server";
import type { ResolvedLabels } from "@/config/business-labels";
import type { CommerceSettings, GeneralSettings } from "@/types/settings";
import { homepageCategoryLists, ROW_CAP } from "./homepage-render-data.server";
import { getStorefrontTrust } from "./storefront-trust.server";

/**
 * The published homepage for the phone app — `GET /api/storefront/home`.
 *
 * THE SAME READS THE HOMEPAGE MAKES, and only the ones its bands need: the
 * rails at the same `ROW_CAP`, the category lists through the same
 * `homepageCategoryLists`, the trust figures through the same
 * `getStorefrontTrust`. Not `getHomepageRenderData` itself, because that also
 * reads banners, testimonials, FAQs, Instagram, coupons, the store address and
 * every product card — none of which a band in this response draws, and the
 * last of which is the full catalogue the app already downloads.
 *
 * Settings are read ONCE and handed down. In a route handler React's `cache()`
 * does not dedupe (there is no render pass), so a helper that read them for
 * itself would be a second round trip, not a free one.
 *
 * Here rather than under features/ because it composes apps/website helpers;
 * the mapping itself is the pure `storefrontHomeFrom`.
 */
export async function getStorefrontHome(): Promise<StorefrontHome> {
  const settings = (await getSettings()) as {
    general?: GeneralSettings;
    commerce?: CommerceSettings;
    labels?: ResolvedLabels;
  };

  const [state, rails, products, catalog, trust, header] = await Promise.all([
    // The whole state, so the choice of `published` over `draft` is made in
    // exactly one place — the mapper — and the draft never leaves it.
    getHomepageState(),
    getHomepageRails(ROW_CAP),
    getProducts(),
    getCatalog(),
    getStorefrontTrust(settings),
    // The header the website draws, for the app's row of tabs — in the SAME
    // round trip. A failed read sends no tabs rather than failing the page
    // (or sending the shipped demo rows the website falls back to).
    (getSiteLayout("header") as Promise<Partial<HeaderSettings> | null>).catch(() => null),
  ]);

  const { currency, timezone } = supportedLocaleOf(settings.general);

  return storefrontHomeFrom(state, {
    rails: rails.rails,
    categoryRails: rails.categoryRails,
    flaggedCategoryRails: rails.flaggedCategoryRails,
    categoryStartingPrices: rails.categoryStartingPrices,
    ...homepageCategoryLists(products, catalog.categories),
    trust,
    productWordPlural: settings.labels?.productWordPlural ?? "Products",
    currency,
    timezone,
    // `getCatalog` is typed loosely; these are its stored rows, read as the
    // storefront's own category readers read them.
    menu: storefrontMenuFrom(header, catalog as unknown as StorefrontMenuCatalog),
  });
}
