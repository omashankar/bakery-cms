import type { Metadata } from "next";
import { AboutPage } from "@/apps/website";
import { canPreviewDraft } from "@/apps/website/lib/preview-access.server";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-about");
}

interface PageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function Page(props: PageProps) {
  const { preview } = await props.searchParams;
  // The parameter asks; the session decides — an admin who sets this page
  // back to Draft to rework it must not still be publishing it at
  // ?preview=1. Same rule as /store/pages/[slug] and the CMS builders.
  const isPreview = preview === "1" && (await canPreviewDraft());
  return <AboutPage preview={isPreview} />;
}
