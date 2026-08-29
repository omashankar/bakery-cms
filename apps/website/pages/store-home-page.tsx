import { StoreHomeContent } from "./store-home-content";
import {
  getDraftHomepageSections,
  getPublishedHomepageSections,
} from "@/features/cms-sections/data/homepage-sections.server";
import { getHomepageRenderData } from "@/apps/website/lib/homepage-render-data.server";

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
 *
 * Everything the SECTIONS need now comes from `getHomepageRenderData`, which the
 * admin builder's preview fetches over an API route. That is the whole point of
 * the split: this page used to assemble those nine props inline, so the builder
 * had no way to obtain them and fell back to browser-side sources that were not
 * equivalent — most visibly, product grids drawn from the shipped demo cakes.
 */
export async function StoreHomePage({ isPreview = false }: StoreHomePageProps) {
  const [sections, data] = await Promise.all([
    isPreview ? getDraftHomepageSections() : getPublishedHomepageSections(),
    getHomepageRenderData(),
  ]);

  return <StoreHomeContent sections={sections} {...data} isPreview={isPreview} />;
}
