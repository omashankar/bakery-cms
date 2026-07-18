import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website";
import { buildRouteMetadata } from "@/features/seo/lib/seo-metadata";
import { getStorefrontProductCards } from "@/features/products/data/products-service";

export const metadata: Metadata = buildRouteMetadata("store-collections");

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
