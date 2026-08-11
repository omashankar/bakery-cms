import { WeddingPageContent } from "./wedding-page-content";
import {
  getDraftWeddingSections,
  getPublishedWeddingSections,
} from "@/features/cms-sections/data/wedding-sections.server";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { getCoupons } from "@/features/commerce/server/commerce.service";
import { getContent } from "@/features/content/server/content.service";
import { publishedOnly } from "@/features/content/lib/storefront-content";
import { getSettings } from "@/features/settings/server/settings.service";
import type { GeneralSettings } from "@/types/settings";
import {
  selectWeddingCollectionProducts,
  selectWeddingOffers,
} from "@/features/products/lib/wedding-catalog";
import type { FaqItem, Testimonial } from "@/types/content";

interface WeddingPageProps {
  /** CMS preview flag comes from the URL: ?cmsPreview=wedding */
  isPreview?: boolean;
}

/**
 * Wedding landing page shell.
 *
 * Sections AND the product/offer data are fetched on the server so the page
 * ships real content in its HTML and both render passes agree — see
 * store-home-page.tsx for the full reasoning.
 */
export async function WeddingPage({ isPreview = false }: WeddingPageProps) {
  const [sections, products, coupons, testimonialsRaw, faqsRaw, settings] =
    await Promise.all([
      isPreview ? getDraftWeddingSections() : getPublishedWeddingSections(),
      getStorefrontProductCards(),
      getCoupons(),
      getContent("testimonials"),
      getContent("faq"),
      // The shop's currency, for a flat-discount badge — see the homepage.
      getSettings(),
    ]);

  return (
    <WeddingPageContent
      sections={sections}
      weddingProducts={selectWeddingCollectionProducts(products, 24)}
      weddingOffers={selectWeddingOffers(coupons, 12, {
        currency: ((settings as { general?: GeneralSettings }).general ?? {}).currency,
      })}
      testimonials={publishedOnly(testimonialsRaw as Testimonial[] | null)}
      faqs={publishedOnly(faqsRaw as FaqItem[] | null)}
      isPreview={isPreview}
    />
  );
}
