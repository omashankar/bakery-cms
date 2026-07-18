import { WeddingPageContent } from "./wedding-page-content";
import {
  getDraftWeddingSections,
  getPublishedWeddingSections,
} from "@/features/cms-sections/data/wedding-sections.server";

interface WeddingPageProps {
  /** CMS preview flag comes from the URL: ?cmsPreview=wedding */
  isPreview?: boolean;
}

/**
 * Wedding landing page shell.
 *
 * Sections are fetched on the server so the page ships real content in its HTML
 * — see store-home-page.tsx for the full reasoning.
 */
export async function WeddingPage({ isPreview = false }: WeddingPageProps) {
  const sections = isPreview
    ? await getDraftWeddingSections()
    : await getPublishedWeddingSections();

  return <WeddingPageContent sections={sections} isPreview={isPreview} />;
}
