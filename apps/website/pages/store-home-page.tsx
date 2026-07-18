import { StoreHomeContent } from "./store-home-content";
import {
  getDraftHomepageSections,
  getPublishedHomepageSections,
} from "@/features/cms-sections/data/homepage-sections.server";
import { getHomepageRails } from "@/features/products/data/products-service";

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
  const [sections, rails] = await Promise.all([
    isPreview ? getDraftHomepageSections() : getPublishedHomepageSections(),
    getHomepageRails(),
  ]);

  return <StoreHomeContent sections={sections} rails={rails} isPreview={isPreview} />;
}
