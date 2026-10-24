import "server-only";
import { unstable_rethrow } from "next/navigation";

import { getSession } from "@/lib/server/auth/dal";
import { getCustomerAccount } from "@/lib/server/auth/customer-dal";
import { getPublicSettings } from "@/features/settings/server/settings.service";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { getPublicCoupons, getPublicZones } from "@/features/commerce/server/commerce.service";
import { getPublicContent } from "@/features/content/server/content.service";
import type { StorefrontCacheSeedData } from "@/apps/website/components/storefront-cache-seed";

/**
 * What the root providers used to fetch in the browser on EVERY storefront
 * page view — public settings, the catalogue, coupons, delivery zones,
 * banners, testimonials, FAQ and who is signed in — read here instead, with
 * the page, from the same functions those APIs answer a visitor with.
 *
 * Eight requests after hydration, on a phone's shared 4G connection, racing
 * the page's own images; and until they landed the checkout priced against
 * whatever this browser last held. Handed to `StorefrontCacheSeed`, which
 * fills the same caches before anything reads them.
 *
 * NULL for a staff session. Those requests answer staff with the WHOLE lists
 * (switched-off coupons, unpublished FAQs) and the admin screens rely on
 * that; seeding them with the visitor's subset would put the wrong list in
 * the cache. Staff keep the old fetch-after-load path.
 *
 * NULL on any failure too, which also means the old path: the page must
 * never fail because its prefetch did.
 */
export async function getStorefrontCacheSeed(
  banners?: unknown[],
): Promise<StorefrontCacheSeedData | null> {
  try {
    const session = await getSession();
    if (session && (session.role === "owner" || session.role === "admin")) return null;

    const [settings, catalog, coupons, zones, bannerItems, testimonials, faqs, account] =
      await Promise.all([
        getPublicSettings(),
        getCatalog(),
        getPublicCoupons(),
        getPublicZones(),
        banners ?? getPublicContent("banners"),
        getPublicContent("testimonials"),
        getPublicContent("faq"),
        getCustomerAccount(),
      ]);

    const customer = account as
      | { email?: string; name?: string; phone?: string; avatarUrl?: string }
      | null;
    return JSON.parse(
      JSON.stringify({
        settings,
        catalog,
        coupons,
        zones,
        banners: bannerItems,
        testimonials,
        faqs,
        customer: customer?.email
          ? {
              email: customer.email,
              name: customer.name ?? "",
              phone: customer.phone ?? "",
              avatarUrl: customer.avatarUrl ?? "",
            }
          : null,
      }),
    ) as StorefrontCacheSeedData;
  } catch (error) {
    // Next's own interrupts (a request-time API read while prerendering, a
    // redirect) are not failures of this read and must reach Next.
    unstable_rethrow(error);
    return null;
  }
}
