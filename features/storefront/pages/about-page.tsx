import { CmsPageView } from "@/features/storefront/components/cms-page-view";
import { getPageForStorefront } from "@/features/content/data/pages.server";

interface AboutPageProps {
  /** CMS draft preview flag from the URL: ?preview=1 */
  preview?: boolean;
}

/** Fetches on the server so the page ships real content in its HTML. */
export async function AboutPage({ preview = false }: AboutPageProps) {
  const page = await getPageForStorefront("about", preview);
  return <CmsPageView page={page} preview={preview} />;
}
