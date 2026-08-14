import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WeddingPage } from "@/apps/website";
import { canPreviewDraft } from "@/apps/website/lib/preview-access.server";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { isWeddingEnabledOnServer } from "@/features/settings/server/modules.server";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-wedding");
}

interface PageProps {
  searchParams: Promise<{ cmsPreview?: string }>;
}

export default async function Page(props: PageProps) {
  // The Wedding module (and a non-bakery business type) hid every link to this
  // page — the navbar item, the mega menu, the FAQ tab, the homepage section —
  // while the route itself kept serving a working wedding-cakes page to anyone
  // holding the URL: a bookmark, a search result, a link someone shared. And it
  // kept taking wedding enquiries. A disabled page has to stop existing.
  if (!(await isWeddingEnabledOnServer())) notFound();

  const { cmsPreview } = await props.searchParams;
  // The parameter asks; the session decides — see the homepage route.
  const isPreview = cmsPreview === "wedding" && (await canPreviewDraft());
  return <WeddingPage isPreview={isPreview} />;
}
