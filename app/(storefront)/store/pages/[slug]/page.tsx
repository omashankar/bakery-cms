import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsPageView } from "@/features/storefront/components/cms-page-view";
import { getPageForStorefront } from "@/features/content/data/pages.server";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/** Per-page metadata now comes from the CMS record rather than a fixed string. */
export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const page = await getPageForStorefront(slug);

  return {
    title: page?.seo?.metaTitle || page?.title || "Page",
    description: page?.seo?.metaDescription || page?.description || "Static content page.",
  };
}

export default async function Page(props: PageProps) {
  const [{ slug }, { preview }] = await Promise.all([props.params, props.searchParams]);
  const isPreview = preview === "1";
  const page = await getPageForStorefront(slug, isPreview);

  // Unpublished and unknown slugs are indistinguishable to a visitor.
  if (!page) notFound();

  return <CmsPageView page={page} preview={isPreview} />;
}
