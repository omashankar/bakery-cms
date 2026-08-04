import type { Metadata } from "next";
import { PrivacyPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-privacy");
}

interface PageProps {
  searchParams: Promise<{ preview?: string }>;
}

export default async function Page(props: PageProps) {
  const { preview } = await props.searchParams;
  return <PrivacyPage preview={preview === "1"} />;
}
