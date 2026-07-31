import { StoreHomeContent } from "./store-home-content";
import {
  getDraftHomepageSections,
  getPublishedHomepageSections,
} from "@/features/cms-sections/data/homepage-sections.server";
import { getHomepageRails, getProducts } from "@/features/products/data/products-service";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { getStorefrontInstagram } from "@/apps/website/lib/storefront-social.server";
import { getContent } from "@/features/content/server/content.service";
import { selectActiveHeroBanners } from "@/features/content/lib/banners-utils";
import { selectHomepageCategories } from "@/features/products/lib/homepage-catalog";
import type { Banner } from "@/types/media";
import type { FaqItem, Testimonial } from "@/types/content";

interface StoreHomePageProps {
  /** CMS preview flag comes from the URL: ?cmsPreview=1 */
  isPreview?: boolean;
}

/**
 * Homepage shell.
 *
 * Sections are fetched here, on the server, so the page ships real content in
 * its HTML. Previously they lived only in the editing browser's localStorage —
 * the server had nothing to render, so the homepage went out as an empty
 * skeleton: invisible to crawlers and a blank first paint for everyone.
 *
 * Preview mode is resolved from the URL on the server too, which is what lets
 * this render without a Suspense boundary: no useSearchParams in the tree means
 * the content lands in the initial HTML rather than streaming in after it.
 */
export async function StoreHomePage({ isPreview = false }: StoreHomePageProps) {
  const [sections, rails, bannersRaw, products, catalog, testimonialsRaw, faqsRaw, instagram] =
    await Promise.all([
      isPreview ? getDraftHomepageSections() : getPublishedHomepageSections(),
      getHomepageRails(),
      // Read banners/testimonials/faq from MongoDB on the server so those sections
      // render the SAME content in the HTML and on hydration (no localStorage race).
      getContent("banners"),
      getProducts(),
      getCatalog(),
      getContent("testimonials"),
      getContent("faq"),
      // The shop's real Instagram, for the same reason: the gallery section used
      // to hardcode a demo handle and ignore Settings → Social entirely.
      getStorefrontInstagram(),
    ]);
  const banners = selectActiveHeroBanners((bannersRaw ?? []) as Banner[], "all");
  // Categories computed on the server too, so the category sections render the
  // same in the HTML and on hydration.
  const categories = selectHomepageCategories(
    products,
    (catalog.categories ?? []) as unknown as Parameters<typeof selectHomepageCategories>[1],
    12
  );

  return (
    <StoreHomeContent
      sections={sections}
      rails={rails}
      banners={banners}
      categories={categories}
      testimonials={(testimonialsRaw ?? []) as Testimonial[]}
      faqs={(faqsRaw ?? []) as FaqItem[]}
      instagram={instagram}
      isPreview={isPreview}
    />
  );
}
