import { notFound } from "next/navigation";
import { CmsPageView } from "@/apps/website/components/cms-page-view";
import { getPageForStorefront } from "@/features/content/data/pages.server";

interface PrivacyPageProps {
  /** CMS draft preview flag from the URL: ?preview=1 */
  preview?: boolean;
}

/** Fetches on the server so the page ships real content in its HTML. */
export async function PrivacyPage({ preview = false }: PrivacyPageProps) {
  const page = await getPageForStorefront("privacy", preview);
  // Missing or unpublished answers 404, as /store/pages/[slug] already does.
  //
  // This used to render a dashed box reading "This page is not available or
  // has not been published yet." under HTTP 200 — a soft 404 that search
  // engines index, with the footer still linking to it and the old SEO title
  // still being emitted. An admin who set the Privacy Policy back to draft to
  // rework it served that box to every customer who clicked the link.
  if (!page) notFound();
  return <CmsPageView page={page} preview={preview} />;
}
