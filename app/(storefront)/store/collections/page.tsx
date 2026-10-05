import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { getStorefrontCategories } from "@/apps/website/lib/storefront-categories.server";

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
  /**
   * `q` IS THE HEADER'S SEARCH BOX, arriving here by GET.
   *
   * The shop asked for the separate /store/search page to go: type in the
   * header, land on results. This is where they land. Reading it here — on
   * the server — is what puts the matches in the FIRST HTML, which is what
   * the deleted page did and what a plain form post has to keep doing.
   */
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function Page(props: PageProps) {
  const [{ category, q }, catalog, categories] = await Promise.all([
    props.searchParams,
    getStorefrontProductCards(),
    getStorefrontCategories(),
  ]);

  return (
    <CollectionsPage
      categorySlug={category ?? ""}
      initialSearch={q ?? ""}
      catalog={catalog}
      categories={categories}
    />
  );
}
