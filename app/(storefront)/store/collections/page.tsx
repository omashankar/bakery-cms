import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { getStorefrontProductCards } from "@/features/products/data/products-service";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-collections");
}

interface PageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function Page(props: PageProps) {
  const [{ category }, catalog] = await Promise.all([
    props.searchParams,
    getStorefrontProductCards(),
  ]);

  return <CollectionsPage categorySlug={category ?? ""} catalog={catalog} />;
}
