import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/apps/website/components/cms-page-view";
import { canPreviewDraft } from "@/apps/website/lib/preview-access.server";
import { getPageForStorefront } from "@/features/content/data/pages.server";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/**
 * Per-page metadata from the CMS record — all of it, not just the title.
 *
 * Only `metaTitle` and `metaDescription` were read. The SEO tab also offers
 * "Hide from search engines (noindex)", "Do not follow links (nofollow)",
 * keywords and an Open Graph image, and stores every one of them — so an admin
 * could publish an internal page with noindex ticked, watch it save, and have it
 * crawled and indexed anyway, while a page shared on social had no preview image.
 * A setting the editor offers has to reach the page.
 */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPageForStorefront(slug);
  const seo = page?.seo;

  const title = seo?.metaTitle || page?.title || "Page";
  const description = seo?.metaDescription || page?.description || "Static content page.";
  const ogImage = seo?.ogImage;

  return {
    title,
    description,
    keywords: seo?.metaKeywords?.length ? seo.metaKeywords : undefined,
    robots: seo?.noIndex
      ? { index: false, follow: false }
      : seo?.noFollow
        ? { index: true, follow: false }
        : undefined,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "article",
    },
  };
}

export default async function Page(props: PageProps) {
  const [{ slug }, { preview }] = await Promise.all([props.params, props.searchParams]);
  // The parameter asks; the session decides.
  //
  // `?preview=1` was honoured with no session check anywhere on this path, so a
  // visitor who knew or guessed a slug read the whole unpublished page — body,
  // title, SEO and its scheduled launch. The seeded draft was proof of it:
  // /store/pages/corporate-catering answered 404, and the same URL with
  // ?preview=1 answered with the entire unreleased page. Same rule as the CMS
  // preview on the homepage and the wedding page.
  const isPreview = preview === "1" && (await canPreviewDraft());
  const page = await getPageForStorefront(slug, isPreview);

  // Unpublished and unknown slugs are indistinguishable to a visitor.
  if (!page) notFound();

  return <CmsPageView page={page} preview={isPreview} />;
}
