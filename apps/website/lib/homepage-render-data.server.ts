import { getStorefrontInstagram } from "./storefront-social.server";
import { getStorefrontLocation } from "./storefront-location.server";
import { getStorefrontTrust } from "./storefront-trust.server";
import { selectStorefrontOffers } from "@/features/commerce/lib/coupon-offers";
import { getCoupons } from "@/features/commerce/server/commerce.service";
import { selectActiveHeroBanners } from "@/features/content/lib/banners-utils";
import { publishedOnly } from "@/features/content/lib/storefront-content";
import { getContent } from "@/features/content/server/content.service";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { selectHomepageCategories } from "@/features/products/lib/homepage-catalog";
import { getHomepageRails, getProducts } from "@/features/products/data/products-service";
import { getSettings } from "@/features/settings/server/settings.service";
import type { CommerceSettings, ContactSettings, GeneralSettings } from "@/types/settings";
import type { FaqItem, Testimonial } from "@/types/content";
import type { Banner } from "@/types/media";

/**
 * The most any one row will ever carry over the wire.
 *
 * Sections then slice this to their OWN "Max ... shown". The cap has to be the
 * same on both surfaces or the two disagree about how many cards there are;
 * matching the 12 that categories and offers already used keeps one number in
 * play instead of three.
 */
const ROW_CAP = 12;

export interface HomepageRenderData {
  rails: Awaited<ReturnType<typeof getHomepageRails>>;
  banners: Banner[];
  categories: ReturnType<typeof selectHomepageCategories>;
  testimonials: Testimonial[];
  faqs: FaqItem[];
  instagram: Awaited<ReturnType<typeof getStorefrontInstagram>>;
  offers: ReturnType<typeof selectStorefrontOffers>;
  storeLocation: Awaited<ReturnType<typeof getStorefrontLocation>>;
  trust: Awaited<ReturnType<typeof getStorefrontTrust>>;
}

/**
 * Everything the homepage sections render, read once on the server.
 *
 * This exists because the builder's preview promises "Same light sections as
 * live store" and was not delivering it. The storefront passed nine
 * server-computed props; the builder passed three, and the renderer fell back to
 * browser-side sources for the rest. Those fallbacks are not equivalent — the
 * product one reads `getAllProducts()`, which STARTS from the 37 hardcoded demo
 * cakes in constants/landing-data.ts and only overwrites the ones whose slug a
 * real product happens to share. So a shop with four cakes previewed four of its
 * six product grids filled entirely with cakes it does not sell, published, and
 * got something else.
 *
 * The cure is one source of truth rather than a better fallback: the storefront
 * calls this directly and the builder fetches it from
 * /api/builders/homepage/preview-data, which calls the same function. A section
 * added later cannot reintroduce the divergence, because there is nowhere else
 * for either surface to get its data.
 *
 * It lives beside the other `storefront-*.server` helpers rather than under
 * features/, because it composes three of them — and a domain module importing
 * an app's layer is what `domainStaysPure` in eslint.config.mjs exists to stop.
 * The builder never imports this file; it fetches the route.
 *
 * Deliberately NOT including `sections`: the storefront reads published (or
 * draft under ?cmsPreview=1) sections, while the builder is editing its own
 * unsaved draft in local state. That difference is the point of a builder, not
 * a bug.
 */
export async function getHomepageRenderData(): Promise<HomepageRenderData> {
  // Read ONCE and shared with the three helpers that need it. Each of them used
  // to fetch the settings singleton for itself, so one homepage render made
  // three round trips to the same document — and ran its `migrate()` pass three
  // times concurrently, all racing to save the same repair.
  const settings = (await getSettings()) as {
    general?: GeneralSettings;
    contact?: ContactSettings;
    commerce?: CommerceSettings;
  };

  const [
    rails,
    bannersRaw,
    products,
    catalog,
    testimonialsRaw,
    faqsRaw,
    instagram,
    coupons,
    storeLocation,
    trust,
  ] = await Promise.all([
    getHomepageRails(ROW_CAP),
    // Read banners/testimonials/faq from MongoDB on the server so those sections
    // render the SAME content in the HTML and on hydration (no localStorage race).
    getContent("banners"),
    getProducts(),
    getCatalog(),
    getContent("testimonials"),
    getContent("faq"),
    // The shop's real Instagram, for the same reason: the gallery section used
    // to hardcode a demo handle and ignore Settings → Social entirely.
    getStorefrontInstagram(settings),
    // The offers row advertised a hardcoded BDAY20 that checkout would refuse.
    getCoupons(),
    // The store locator invented a pincode search over three hardcoded Mumbai
    // outlets; this is the shop's real address and hours.
    getStorefrontLocation(settings),
    // The hero chip and the trust bar stated the shop's rating, its delivery
    // speed and its free-delivery threshold as CONSTANTS. All three are values
    // this CMS already stores, so each was a second copy of an answer the shop
    // had given — and two of them were wrong.
    getStorefrontTrust(settings),
  ]);

  return {
    rails,
    // "homepage", not "all" — `"all"` is the WILDCARD in this selector, meaning
    // "apply no visibility filter", not the visibility value "all". Passing it
    // here made the admin's Visibility field inert: a banner scoped to
    // "Collections pages" was rendered on the homepage anyway.
    banners: selectActiveHeroBanners((bannersRaw ?? []) as Banner[], "homepage"),
    categories: selectHomepageCategories(
      products,
      (catalog.categories ?? []) as unknown as Parameters<typeof selectHomepageCategories>[1],
      ROW_CAP,
    ),
    testimonials: publishedOnly(testimonialsRaw as Testimonial[] | null),
    faqs: publishedOnly(faqsRaw as FaqItem[] | null),
    instagram,
    offers: selectStorefrontOffers(coupons, ROW_CAP, { currency: settings.general?.currency }),
    storeLocation,
    trust,
  };
}
