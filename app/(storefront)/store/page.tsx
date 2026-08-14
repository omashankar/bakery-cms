import type { Metadata } from "next";
import { StoreHomePage } from "@/apps/website";
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
  return buildRouteMetadataServer("store-home");
}

interface PageProps {
  searchParams: Promise<{ cmsPreview?: string }>;
}

export default async function Page(props: PageProps) {
  const { cmsPreview } = await props.searchParams;
  // The parameter asks; the session decides. Without this anyone holding the URL
  // read the unpublished homepage.
  const isPreview = cmsPreview === "1" && (await canPreviewDraft());
  return <StoreHomePage isPreview={isPreview} />;
}
