import type { Metadata } from "next";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import { Suspense } from "react";
import { SearchPage } from "@/apps/website";
import { buildRouteMetadataServer } from "@/features/seo/server/seo-store.server";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Per request, not at module load.
 *
 * `export const metadata = ...` is evaluated once when this module loads, so
 * it could never reflect what the admin saved — and the builder it called
 * read a module variable that only client code writes, i.e. the demo seed.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRouteMetadataServer("store-search");
}

export default async function Page() {
  const catalog = await getStorefrontProductCards();

  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPage catalog={catalog} />
    </Suspense>
  );
}

function SearchPageFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16">
      <Skeleton className="mb-6 h-10 w-full max-w-xl" />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    </div>
  );
}
